using System.Net;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;

namespace GameScore.Api.Tests;

public class HealthEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    static HealthEndpointTests()
    {
        Environment.SetEnvironmentVariable("DATABASE_URL", "Host=localhost;Database=gamescore_test;Username=postgres;Password=postgres");
        Environment.SetEnvironmentVariable("JWT_SECRET", "test-access-secret-at-least-32-chars-long");
        Environment.SetEnvironmentVariable("JWT_REFRESH_SECRET", "test-refresh-secret-at-least-32-chars-long");
        Environment.SetEnvironmentVariable("NODE_ENV", "test");
    }

    [Fact]
    public async Task Health_returns_json_contract()
    {
        await using var factory = new WebApplicationFactory<Program>();
        var client = factory.CreateClient();
        var response = await client.GetAsync("/health");
        response.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.ServiceUnavailable);
        var json = await response.Content.ReadAsStringAsync();
        json.Should().Contain("\"status\"");
        json.Should().Contain("\"checks\"");
    }
}
