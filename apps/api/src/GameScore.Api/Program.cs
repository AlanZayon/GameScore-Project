using System.Text.Json;
using System.Text.Json.Serialization;
using GameScore.Api;
using GameScore.Api.Authorization;
using GameScore.Api.Middleware;
using GameScore.Application.Configuration;
using GameScore.Infrastructure;
using GameScore.Infrastructure.Jobs;
using Hangfire;
using Microsoft.AspNetCore.Authorization;
using Serilog;

// Load monorepo .env before reading configuration (same vars as Nest).
// BaseDirectory is typically .../GameScore.Api/bin/Debug/net10.0 — 7 levels up is the repo root.
DotEnv.Load(
    Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "..", "..", ".env")),
    Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", "..", ".env")),
    Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), ".env")),
    Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "..", ".env")));

var builder = WebApplication.CreateBuilder(args);

AppConfig config;
try
{
    config = AppConfigLoader.Load();
}
catch (ConfigurationError ex)
{
    Console.Error.WriteLine(ex.Message);
    throw;
}

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Is(Serilog.Events.LogEventLevel.Information)
    .WriteTo.Console()
    .CreateLogger();

// Prisma/legacy timestamps often arrive as Unspecified; allow Npgsql to treat them as UTC.
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

builder.Host.UseSerilog();
builder.WebHost.UseUrls($"http://0.0.0.0:{config.Port}");

builder.Services.AddSingleton<IAuthorizationMiddlewareResultHandler, JsonAuthorizationMiddlewareResultHandler>();
builder.Services.AddGameScoreInfrastructure(config);
builder.Services.AddGameScoreAuth(config);
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        // Nest/Prisma enums are SCREAMING_SNAKE (USER, PUBLISHED). Do not camelCase them.
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(namingPolicy: null));
    });

if (config.EnableSwagger)
{
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen();
}

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(config.CorsOrigins.ToArray())
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()
            .WithExposedHeaders("x-request-id");
    });
});

var app = builder.Build();

app.UseMiddleware<RequestIdMiddleware>();
app.UseMiddleware<ExceptionMiddleware>();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

if (config.EnableSwagger)
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "GameScore API v1");
        options.RoutePrefix = "api/docs";
    });
}

app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    try
    {
        var recurring = scope.ServiceProvider.GetRequiredService<IRecurringJobManager>();
        recurring.AddOrUpdate<BackgroundJobRunner>(
            JobNames.SnapshotScores,
            runner => runner.SnapshotScoresAsync(CancellationToken.None),
            "15 3 * * *");
        recurring.AddOrUpdate<BackgroundJobRunner>(
            JobNames.Maintenance,
            runner => runner.MaintenanceAsync(CancellationToken.None),
            "0 4 * * *");
    }
    catch (Exception ex)
    {
        Log.Warning(ex, "Failed to register Hangfire recurring jobs; continuing without them");
    }
}

app.Run();

public partial class Program;
