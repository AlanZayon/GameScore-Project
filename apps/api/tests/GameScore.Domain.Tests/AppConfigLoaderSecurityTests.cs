using FluentAssertions;
using GameScore.Application.Configuration;

namespace GameScore.Domain.Tests;

public class AppConfigLoaderSecurityTests
{
    private static Dictionary<string, string?> BaseEnv(string nodeEnv) => new(StringComparer.Ordinal)
    {
        ["NODE_ENV"] = nodeEnv,
        ["DATABASE_URL"] = "Host=localhost;Database=gamescore;Username=u;Password=p",
        ["JWT_SECRET"] = "production-grade-access-secret-value-abc12345",
        ["JWT_REFRESH_SECRET"] = "production-grade-refresh-secret-value-xyz98765",
        ["SMTP_HOST"] = "smtp.example.com",
        ["SMTP_FROM"] = "GameScore <noreply@example.com>",
    };

    [Fact]
    public void Production_rejects_dev_only_jwt_secrets()
    {
        var env = BaseEnv("production");
        env["JWT_SECRET"] = "dev-only-access-token-secret-change-me-please-0123456789";
        env["JWT_REFRESH_SECRET"] = "dev-only-refresh-token-secret-change-me-please-9876543210";

        var act = () => AppConfigLoader.Load(env);
        act.Should().Throw<ConfigurationError>()
            .Which.Message.Should().Contain("JWT_SECRET");
    }

    [Fact]
    public void Production_accepts_strong_distinct_secrets()
    {
        var config = AppConfigLoader.Load(BaseEnv("production"));
        config.IsProduction.Should().BeTrue();
        config.Jwt.AccessSecret.Should().NotBe(config.Jwt.RefreshSecret);
    }

    [Fact]
    public void NormalizeNpgsqlUrl_preserves_sslmode_for_neon()
    {
        var normalized = AppConfigLoader.NormalizeNpgsqlUrl(
            "postgresql://user:pass@ep-test.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public");

        normalized.Should().Contain("Host=ep-test.us-east-2.aws.neon.tech");
        normalized.Should().Contain("SSL Mode=Require");
        normalized.Should().NotContain("schema");
    }

    [Fact]
    public void NormalizeNpgsqlUrl_forces_ssl_for_neon_host_without_query()
    {
        var normalized = AppConfigLoader.NormalizeNpgsqlUrl(
            "postgresql://user:pass@ep-test.neon.tech/neondb");

        normalized.Should().Contain("SSL Mode=Require");
    }
}
