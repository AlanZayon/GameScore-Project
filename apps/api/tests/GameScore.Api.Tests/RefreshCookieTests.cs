using FluentAssertions;
using GameScore.Api.Auth;
using GameScore.Application.Configuration;
using Microsoft.AspNetCore.Http;

namespace GameScore.Api.Tests;

public class RefreshCookieTests
{
    [Fact]
    public void Production_cross_site_cookie_is_none_secure_partitioned()
    {
        var config = BaseConfig(nodeEnv: "production", cookieSameSite: "None");

        var options = RefreshCookie.CreateOptions(config, DateTimeOffset.UtcNow.AddDays(1));
        options.SameSite.Should().Be(SameSiteMode.None);
        options.Secure.Should().BeTrue();
        options.HttpOnly.Should().BeTrue();
        options.Extensions.Should().Contain("Partitioned");
    }

    [Fact]
    public void Production_same_origin_proxy_cookie_is_lax()
    {
        var config = BaseConfig(nodeEnv: "production", cookieSameSite: "Lax");

        var options = RefreshCookie.CreateOptions(config, DateTimeOffset.UtcNow.AddDays(1));
        options.SameSite.Should().Be(SameSiteMode.Lax);
        options.Secure.Should().BeTrue();
        options.Extensions.Should().NotContain("Partitioned");
    }

    [Fact]
    public void Development_cookie_is_lax_and_insecure()
    {
        var config = BaseConfig(nodeEnv: "development", cookieSameSite: "Lax");

        var options = RefreshCookie.CreateOptions(config);
        options.SameSite.Should().Be(SameSiteMode.Lax);
        options.Secure.Should().BeFalse();
        options.Extensions.Should().NotContain("Partitioned");
    }

    private static AppConfig BaseConfig(string nodeEnv, string cookieSameSite) => new()
    {
        NodeEnv = nodeEnv,
        DatabaseUrl = "Host=localhost",
        CookieSameSite = cookieSameSite,
        Jwt = new JwtConfig
        {
            AccessSecret = "a".PadRight(40, 'a'),
            RefreshSecret = "b".PadRight(40, 'b'),
        },
        Igdb = new IgdbConfig(),
        Ranking = new RankingConfig(),
        AntiSpam = new AntiSpamConfig(),
    };
}
