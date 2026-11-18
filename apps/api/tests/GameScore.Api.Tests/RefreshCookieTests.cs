using FluentAssertions;
using GameScore.Api.Auth;
using GameScore.Application.Configuration;
using Microsoft.AspNetCore.Http;

namespace GameScore.Api.Tests;

public class RefreshCookieTests
{
    [Fact]
    public void Production_cookie_is_none_and_secure()
    {
        var config = new AppConfig
        {
            NodeEnv = "production",
            DatabaseUrl = "Host=localhost",
            Jwt = new JwtConfig
            {
                AccessSecret = "a".PadRight(40, 'a'),
                RefreshSecret = "b".PadRight(40, 'b'),
            },
            Igdb = new IgdbConfig(),
            Ranking = new RankingConfig(),
            AntiSpam = new AntiSpamConfig(),
        };

        var options = RefreshCookie.CreateOptions(config, DateTimeOffset.UtcNow.AddDays(1));
        options.SameSite.Should().Be(SameSiteMode.None);
        options.Secure.Should().BeTrue();
        options.HttpOnly.Should().BeTrue();
    }

    [Fact]
    public void Development_cookie_is_lax_and_insecure()
    {
        var config = new AppConfig
        {
            NodeEnv = "development",
            DatabaseUrl = "Host=localhost",
            Jwt = new JwtConfig
            {
                AccessSecret = "a".PadRight(40, 'a'),
                RefreshSecret = "b".PadRight(40, 'b'),
            },
            Igdb = new IgdbConfig(),
            Ranking = new RankingConfig(),
            AntiSpam = new AntiSpamConfig(),
        };

        var options = RefreshCookie.CreateOptions(config);
        options.SameSite.Should().Be(SameSiteMode.Lax);
        options.Secure.Should().BeFalse();
    }
}
