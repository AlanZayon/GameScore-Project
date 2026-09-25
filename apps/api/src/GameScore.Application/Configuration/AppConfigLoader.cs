namespace GameScore.Application.Configuration;

public sealed class ConfigurationError : Exception
{
    public ConfigurationError(IReadOnlyList<string> problems)
        : base(
            "Invalid environment configuration:\n"
            + string.Join("\n", problems.Select(p => $"  - {p}"))
            + "\nCopy .env.example to .env and fill in the missing values.")
    {
    }
}

public static class AppConfigLoader
{
    public static AppConfig Load(IReadOnlyDictionary<string, string?>? env = null)
    {
        env ??= Environment.GetEnvironmentVariables()
            .Cast<System.Collections.DictionaryEntry>()
            .ToDictionary(
                e => e.Key.ToString()!,
                e => e.Value?.ToString(),
                StringComparer.Ordinal);

        var problems = new List<string>();
        var nodeEnv = ReadNodeEnv(env);
        var isProduction = nodeEnv == "production";

        var databaseUrl = ReadString(env, "DATABASE_URL");
        if (databaseUrl.Problem is { } dbProblem)
        {
            problems.Add(dbProblem);
        }

        var accessSecret = ReadString(env, "JWT_SECRET");
        if (accessSecret.Problem is { } accessProblem)
        {
            problems.Add(accessProblem);
        }

        var refreshSecret = ReadString(env, "JWT_REFRESH_SECRET");
        if (refreshSecret.Problem is { } refreshProblem)
        {
            problems.Add(refreshProblem);
        }

        if (accessSecret.Value is not null
            && refreshSecret.Value is not null
            && accessSecret.Value == refreshSecret.Value)
        {
            problems.Add("JWT_SECRET and JWT_REFRESH_SECRET must be different values");
        }

        if (isProduction)
        {
            if (accessSecret.Value is { Length: < 32 })
            {
                problems.Add("JWT_SECRET must be at least 32 characters long in production");
            }

            if (refreshSecret.Value is { Length: < 32 })
            {
                problems.Add("JWT_REFRESH_SECRET must be at least 32 characters long in production");
            }

            if (string.IsNullOrWhiteSpace(env.GetValueOrDefault("SMTP_HOST")))
            {
                problems.Add("SMTP_HOST is required in production");
            }

            if (string.IsNullOrWhiteSpace(env.GetValueOrDefault("SMTP_FROM")))
            {
                problems.Add("SMTP_FROM is required in production");
            }
        }

        if (problems.Count > 0)
        {
            throw new ConfigurationError(problems);
        }

        var igdbClientId = env.GetValueOrDefault("IGDB_CLIENT_ID")?.Trim();
        var igdbClientSecret = env.GetValueOrDefault("IGDB_CLIENT_SECRET")?.Trim();

        var smtpHost = env.GetValueOrDefault("SMTP_HOST")?.Trim();
        SmtpConfig? smtp = null;
        if (!string.IsNullOrWhiteSpace(smtpHost))
        {
            smtp = new SmtpConfig
            {
                Host = smtpHost,
                Port = ReadInt(env, "SMTP_PORT", 587),
                Secure = ReadBoolean(env, "SMTP_SECURE", false),
                User = env.GetValueOrDefault("SMTP_USER")?.Trim(),
                Pass = env.GetValueOrDefault("SMTP_PASS")?.Trim(),
                From = env.GetValueOrDefault("SMTP_FROM")?.Trim() ?? "GameScore <noreply@localhost>",
            };
        }

        return new AppConfig
        {
            NodeEnv = nodeEnv,
            Port = ReadInt(env, "API_PORT", 3001),
            GlobalPrefix = env.GetValueOrDefault("API_GLOBAL_PREFIX")?.Trim() ?? "",
            LogLevel = env.GetValueOrDefault("LOG_LEVEL")?.Trim()
                ?? (isProduction ? "info" : "debug"),
            CorsOrigins = (env.GetValueOrDefault("CORS_ORIGINS")?.Trim() ?? "http://localhost:3000")
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToList(),
            // Prisma URLs include ?schema=public; Npgsql rejects that query key.
            DatabaseUrl = NormalizeNpgsqlUrl(databaseUrl.Value!),
            RedisUrl = env.GetValueOrDefault("REDIS_URL")?.Trim(),
            WebUrl = env.GetValueOrDefault("NEXT_PUBLIC_SITE_URL")?.Trim() ?? "http://localhost:3000",
            EnableSwagger = !isProduction || env.GetValueOrDefault("ENABLE_SWAGGER") == "true",
            Jwt = new JwtConfig
            {
                AccessSecret = accessSecret.Value!,
                RefreshSecret = refreshSecret.Value!,
                AccessTtlSeconds = ReadInt(env, "JWT_ACCESS_TOKEN_TTL", 900),
                RefreshTtlSeconds = ReadInt(env, "JWT_REFRESH_TOKEN_TTL", 2_592_000),
            },
            Igdb = new IgdbConfig
            {
                ClientId = string.IsNullOrWhiteSpace(igdbClientId) ? null : igdbClientId,
                ClientSecret = string.IsNullOrWhiteSpace(igdbClientSecret) ? null : igdbClientSecret,
            },
            Ranking = new RankingConfig
            {
                MinimumReviews = ReadInt(env, "RANKING_MINIMUM_REVIEWS", 50),
                ScoreLabelMinimumReviews = ReadInt(env, "SCORE_LABEL_MINIMUM_REVIEWS", 10),
                PlatformMinimumReviews = ReadInt(env, "PLATFORM_MINIMUM_REVIEWS", 5),
                TrendingWindowDays = ReadInt(env, "TRENDING_WINDOW_DAYS", 14),
            },
            AntiSpam = new AntiSpamConfig
            {
                MaxReviewsPerHour = ReadInt(env, "ANTISPAM_MAX_REVIEWS_PER_HOUR", 5),
                MaxReviewsPerDay = ReadInt(env, "ANTISPAM_MAX_REVIEWS_PER_DAY", 20),
                MinimumTextLength = ReadInt(env, "ANTISPAM_MIN_TEXT_LENGTH", 20),
                MaxAccountsPerIp = ReadInt(env, "ANTISPAM_MAX_ACCOUNTS_PER_IP", 5),
            },
            Smtp = smtp,
        };
    }

    private static string ReadNodeEnv(IReadOnlyDictionary<string, string?> env)
    {
        var raw = env.GetValueOrDefault("NODE_ENV")?.Trim();
        return raw switch
        {
            "production" or "test" or "development" => raw,
            _ => "development",
        };
    }

    /// <summary>
    /// Converts a Prisma-style Postgres URL into an Npgsql keyword connection string.
    /// Strips Prisma-only query keys (notably <c>schema</c>).
    /// </summary>
    internal static string NormalizeNpgsqlUrl(string url)
    {
        var trimmed = url.Trim();
        if (trimmed.StartsWith("Host=", StringComparison.OrdinalIgnoreCase)
            || trimmed.StartsWith("Server=", StringComparison.OrdinalIgnoreCase))
        {
            return trimmed;
        }

        if (!trimmed.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            && !trimmed.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return trimmed;
        }

        // Uri requires a known scheme; map postgres(ql) → http for parsing only.
        var parseable = "http://" + trimmed[(trimmed.IndexOf("://", StringComparison.Ordinal) + 3)..];
        if (!Uri.TryCreate(parseable, UriKind.Absolute, out var uri))
        {
            return trimmed;
        }

        var userInfo = uri.UserInfo.Split(':', 2);
        var username = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : "";
        var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
        var database = uri.AbsolutePath.Trim('/');
        var host = uri.Host is "localhost" ? "127.0.0.1" : uri.Host;
        var port = uri.IsDefaultPort ? 5432 : uri.Port;

        var builder = new System.Text.StringBuilder();
        builder.Append("Host=").Append(host);
        builder.Append(";Port=").Append(port);
        if (!string.IsNullOrEmpty(database))
        {
            builder.Append(";Database=").Append(database);
        }

        if (!string.IsNullOrEmpty(username))
        {
            builder.Append(";Username=").Append(username);
        }

        if (!string.IsNullOrEmpty(password))
        {
            builder.Append(";Password=").Append(password);
        }

        return builder.ToString();
    }

    private static (string? Value, string? Problem) ReadString(
        IReadOnlyDictionary<string, string?> env,
        string key,
        string? fallback = null)
    {
        var raw = env.GetValueOrDefault(key)?.Trim();
        if (!string.IsNullOrEmpty(raw))
        {
            return (raw, null);
        }

        if (fallback is not null)
        {
            return (fallback, null);
        }

        return (null, $"{key} is required");
    }

    private static int ReadInt(IReadOnlyDictionary<string, string?> env, string key, int fallback)
    {
        var raw = env.GetValueOrDefault(key)?.Trim();
        if (string.IsNullOrEmpty(raw))
        {
            return fallback;
        }

        return int.TryParse(raw, out var parsed) ? parsed : fallback;
    }

    private static bool ReadBoolean(IReadOnlyDictionary<string, string?> env, string key, bool fallback)
    {
        var raw = env.GetValueOrDefault(key)?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(raw))
        {
            return fallback;
        }

        return raw is "true" or "1" or "yes";
    }
}
