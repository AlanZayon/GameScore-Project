namespace GameScore.Application.Configuration;

public sealed class AppConfig
{
    public required string NodeEnv { get; init; }
    public bool IsProduction => NodeEnv == "production";
    public bool IsTest => NodeEnv == "test";
    public int Port { get; init; } = 3001;
    public string GlobalPrefix { get; init; } = "";
    public string LogLevel { get; init; } = "debug";
    public IReadOnlyList<string> CorsOrigins { get; init; } = ["http://localhost:3000"];
    public required string DatabaseUrl { get; init; }
    public string? RedisUrl { get; init; }
    public string WebUrl { get; init; } = "http://localhost:3000";
    public bool EnableSwagger { get; init; } = true;
    public required JwtConfig Jwt { get; init; }
    public required IgdbConfig Igdb { get; init; }
    public required RankingConfig Ranking { get; init; }
    public required AntiSpamConfig AntiSpam { get; init; }
    public SmtpConfig? Smtp { get; init; }
}

public sealed class JwtConfig
{
    public required string AccessSecret { get; init; }
    public required string RefreshSecret { get; init; }
    public int AccessTtlSeconds { get; init; } = 900;
    public int RefreshTtlSeconds { get; init; } = 2_592_000;
}

public sealed class IgdbConfig
{
    public string? ClientId { get; init; }
    public string? ClientSecret { get; init; }
    public bool Configured => !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(ClientSecret);
}

public sealed class RankingConfig
{
    public int MinimumReviews { get; init; } = 50;
    public int ScoreLabelMinimumReviews { get; init; } = 10;
    public int PlatformMinimumReviews { get; init; } = 5;
    public int TrendingWindowDays { get; init; } = 14;
}

public sealed class AntiSpamConfig
{
    public int MaxReviewsPerHour { get; init; } = 5;
    public int MaxReviewsPerDay { get; init; } = 20;
    public int MinimumTextLength { get; init; } = 20;
    public int MaxAccountsPerIp { get; init; } = 5;
}

public sealed class SmtpConfig
{
    public required string Host { get; init; }
    public int Port { get; init; } = 587;
    public bool Secure { get; init; }
    public string? User { get; init; }
    public string? Pass { get; init; }
    public required string From { get; init; }
}
