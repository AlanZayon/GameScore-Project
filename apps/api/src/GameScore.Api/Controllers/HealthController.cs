using GameScore.Application.Configuration;
using GameScore.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GameScore.Api.Controllers;

[ApiController]
[Route("health")]
public sealed class HealthController(
    IOptions<AppConfig> config,
    GameScoreDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var databaseUp = false;
        try
        {
            databaseUp = await db.Database.CanConnectAsync(cancellationToken);
        }
        catch
        {
            databaseUp = false;
        }

        var body = new
        {
            status = databaseUp ? "ok" : "degraded",
            environment = config.Value.NodeEnv,
            uptimeSeconds = (int)(Environment.TickCount64 / 1000),
            timestamp = DateTime.UtcNow.ToString("O"),
            checks = new { database = databaseUp ? "up" : "down" },
            features = new
            {
                igdbConfigured = config.Value.Igdb.Configured,
                redisConfigured = config.Value.RedisUrl is not null,
            },
        };

        return StatusCode(databaseUp ? StatusCodes.Status200OK : StatusCodes.Status503ServiceUnavailable, body);
    }
}
