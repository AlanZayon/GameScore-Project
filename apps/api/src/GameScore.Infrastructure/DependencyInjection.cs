using GameScore.Application.Configuration;
using GameScore.Infrastructure.Auth;
using GameScore.Infrastructure.Cache;
using GameScore.Infrastructure.Email;
using GameScore.Infrastructure.Games;
using GameScore.Infrastructure.Integrations;
using GameScore.Infrastructure.Jobs;
using GameScore.Infrastructure.Persistence;
using GameScore.Infrastructure.Rankings;
using GameScore.Infrastructure.Ratings;
using GameScore.Infrastructure.Reviews;
using GameScore.Infrastructure.Search;
using GameScore.Infrastructure.Users;
using GameScore.Infrastructure.Admin;
using Hangfire;
using Hangfire.MemoryStorage;
using Hangfire.Redis.StackExchange;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Npgsql;
using StackExchange.Redis;

namespace GameScore.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddGameScoreInfrastructure(
        this IServiceCollection services,
        AppConfig config)
    {
        services.AddSingleton(config);
        services.AddSingleton(Microsoft.Extensions.Options.Options.Create(config));

        var dataSourceBuilder = new NpgsqlDataSourceBuilder(config.DatabaseUrl);
        var enumNames = new Npgsql.NameTranslation.NpgsqlNullNameTranslator();
        dataSourceBuilder.MapEnum<DbUserRole>("UserRole", enumNames);
        dataSourceBuilder.MapEnum<DbUserStatus>("UserStatus", enumNames);
        dataSourceBuilder.MapEnum<DbReviewStatus>("ReviewStatus", enumNames);
        dataSourceBuilder.MapEnum<DbReviewModerationStatus>("ReviewModerationStatus", enumNames);
        dataSourceBuilder.MapEnum<DbReportReason>("ReportReason", enumNames);
        dataSourceBuilder.MapEnum<DbReportStatus>("ReportStatus", enumNames);
        dataSourceBuilder.MapEnum<DbReviewBombStatus>("ReviewBombStatus", enumNames);
        dataSourceBuilder.MapEnum<DbReviewBombDirection>("ReviewBombDirection", enumNames);
        dataSourceBuilder.MapEnum<DbExternalProvider>("ExternalProvider", enumNames);
        dataSourceBuilder.MapEnum<DbPlatformFamily>("PlatformFamily", enumNames);
        dataSourceBuilder.MapEnum<DbGameRelationKind>("GameRelationKind", enumNames);
        dataSourceBuilder.MapEnum<DbReputationReason>("ReputationReason", enumNames);
        dataSourceBuilder.MapEnum<DbAuditAction>("AuditAction", enumNames);
        var dataSource = dataSourceBuilder.Build();
        services.AddSingleton(dataSource);

        services.AddDbContext<GameScoreDbContext>(options =>
        {
            options.UseNpgsql(dataSource, npgsql =>
            {
                npgsql.MapEnum<DbUserRole>("UserRole", nameTranslator: enumNames);
                npgsql.MapEnum<DbUserStatus>("UserStatus", nameTranslator: enumNames);
                npgsql.MapEnum<DbReviewStatus>("ReviewStatus", nameTranslator: enumNames);
                npgsql.MapEnum<DbReviewModerationStatus>("ReviewModerationStatus", nameTranslator: enumNames);
                npgsql.MapEnum<DbReportReason>("ReportReason", nameTranslator: enumNames);
                npgsql.MapEnum<DbReportStatus>("ReportStatus", nameTranslator: enumNames);
                npgsql.MapEnum<DbReviewBombStatus>("ReviewBombStatus", nameTranslator: enumNames);
                npgsql.MapEnum<DbReviewBombDirection>("ReviewBombDirection", nameTranslator: enumNames);
                npgsql.MapEnum<DbExternalProvider>("ExternalProvider", nameTranslator: enumNames);
                npgsql.MapEnum<DbPlatformFamily>("PlatformFamily", nameTranslator: enumNames);
                npgsql.MapEnum<DbGameRelationKind>("GameRelationKind", nameTranslator: enumNames);
                npgsql.MapEnum<DbReputationReason>("ReputationReason", nameTranslator: enumNames);
                npgsql.MapEnum<DbAuditAction>("AuditAction", nameTranslator: enumNames);
                npgsql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
            });
        });

        services.AddMemoryCache();
        IConnectionMultiplexer? redis = null;
        if (!string.IsNullOrWhiteSpace(config.RedisUrl))
        {
            try
            {
                var redisEndpoint = NormalizeRedisEndpoint(config.RedisUrl);
                var options = ConfigurationOptions.Parse(redisEndpoint);
                options.AbortOnConnectFail = false;
                redis = ConnectionMultiplexer.Connect(options);
                if (!redis.IsConnected)
                {
                    redis.Dispose();
                    redis = null;
                }
                else
                {
                    services.AddSingleton(redis);
                }
            }
            catch
            {
                redis = null;
            }
        }

        services.AddSingleton<CacheService>(sp =>
        {
            var memory = sp.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>();
            var logger = sp.GetRequiredService<Microsoft.Extensions.Logging.ILogger<CacheService>>();
            var redisMux = sp.GetService<IConnectionMultiplexer>();
            return new CacheService(memory, Microsoft.Extensions.Options.Options.Create(config), logger, redisMux);
        });
        services.AddSingleton<PasswordHasher>();
        services.AddScoped<TokenService>();
        services.AddScoped<AuthService>();
        services.AddScoped<GamesService>();
        services.AddScoped<RankingsService>();
        services.AddScoped<ReviewDataAccess>();
        services.AddScoped<AntiSpamService>();
        services.AddScoped<ReviewRankingService>();
        services.AddScoped<ReputationService>();
        services.AddScoped<ReviewsService>();
        services.AddScoped<UsersService>();
        services.AddScoped<UserStatisticsService>();
        services.AddScoped<AdminService>();
        services.AddScoped<AuditService>();
        services.AddScoped<ScoreRecalculationService>();
        services.AddScoped<ReviewBombDetectorService>();
        services.AddScoped<SnapshotService>();
        services.AddScoped<PostgresSearchService>();
        services.AddScoped<GameImportService>();
        services.AddScoped<GameSyncService>();
        services.AddScoped<IgdbClient>();
        services.AddScoped<BackgroundJobScheduler>();
        services.AddScoped<BackgroundJobRunner>();

        services.AddHttpClient("igdb");

        if (config.Smtp is not null)
        {
            services.AddSingleton<IEmailSender, SmtpEmailSender>();
        }
        else
        {
            services.AddSingleton<IEmailSender, ConsoleEmailSender>();
        }

        services.AddHangfire(cfg =>
        {
            if (redis is not null && redis.IsConnected)
            {
                cfg.UseRedisStorage(redis, new RedisStorageOptions { Prefix = "hangfire:gamescore:" });
            }
            else
            {
                cfg.UseMemoryStorage();
            }
        });
        services.AddHangfireServer();

        return services;
    }

    /// <summary>
    /// StackExchange.Redis wants <c>host:port</c>, not <c>redis://host:port</c>.
    /// </summary>
    private static string NormalizeRedisEndpoint(string url)
    {
        var trimmed = url.Trim()
            .Replace("localhost", "127.0.0.1", StringComparison.OrdinalIgnoreCase);

        if (trimmed.StartsWith("redis://", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["redis://".Length..];
        }
        else if (trimmed.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["rediss://".Length..];
        }

        // Drop path/query if present.
        var slash = trimmed.IndexOf('/');
        if (slash >= 0)
        {
            trimmed = trimmed[..slash];
        }

        return trimmed;
    }
}
