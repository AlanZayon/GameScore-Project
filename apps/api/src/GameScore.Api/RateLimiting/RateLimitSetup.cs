using AspNetCoreRateLimit;
using GameScore.Application.Errors;
using System.Text.Json;

namespace GameScore.Api.RateLimiting;

public static class RateLimitSetup
{
    public static IServiceCollection AddGameScoreRateLimiting(this IServiceCollection services)
    {
        services.Configure<IpRateLimitOptions>(options =>
        {
            options.EnableEndpointRateLimiting = true;
            options.StackBlockedRequests = false;
            options.RealIpHeader = "X-Forwarded-For";
            options.HttpStatusCode = StatusCodes.Status429TooManyRequests;
            options.GeneralRules =
            [
                new RateLimitRule
                {
                    Endpoint = "*",
                    Period = "1m",
                    Limit = 120,
                },
                new RateLimitRule
                {
                    Endpoint = "post:/auth/register",
                    Period = "1m",
                    Limit = 5,
                },
                new RateLimitRule
                {
                    Endpoint = "post:/auth/login",
                    Period = "1m",
                    Limit = 10,
                },
                new RateLimitRule
                {
                    Endpoint = "post:/auth/forgot-password",
                    Period = "1m",
                    Limit = 5,
                },
                new RateLimitRule
                {
                    Endpoint = "post:/auth/resend-verification",
                    Period = "1m",
                    Limit = 5,
                },
                new RateLimitRule
                {
                    Endpoint = "post:/auth/reset-password",
                    Period = "1m",
                    Limit = 5,
                },
                new RateLimitRule
                {
                    Endpoint = "post:/auth/verify-email",
                    Period = "1m",
                    Limit = 10,
                },
                new RateLimitRule
                {
                    Endpoint = "*:/games/*/reviews",
                    Period = "1m",
                    Limit = 30,
                },
                new RateLimitRule
                {
                    Endpoint = "*:/games/external/*/reviews",
                    Period = "1m",
                    Limit = 20,
                },
                new RateLimitRule
                {
                    Endpoint = "post:/reviews/*/vote",
                    Period = "1m",
                    Limit = 30,
                },
                new RateLimitRule
                {
                    Endpoint = "post:/reviews/*/report",
                    Period = "1m",
                    Limit = 20,
                },
                new RateLimitRule
                {
                    Endpoint = "get:/search",
                    Period = "1m",
                    Limit = 30,
                },
                new RateLimitRule
                {
                    Endpoint = "get:/search/*",
                    Period = "1m",
                    Limit = 30,
                },
                new RateLimitRule
                {
                    Endpoint = "post:/search/import",
                    Period = "1m",
                    Limit = 10,
                },
            ];

            options.QuotaExceededResponse = new QuotaExceededResponse
            {
                Content = JsonSerializer.Serialize(new
                {
                    code = ErrorCodes.RateLimitExceeded,
                    message = "Too many requests, please slow down",
                    details = (object?)null,
                }),
                ContentType = "application/json",
                StatusCode = StatusCodes.Status429TooManyRequests,
            };
        });

        services.AddInMemoryRateLimiting();
        services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();
        return services;
    }
}
