using System.Security.Claims;
using System.Text;
using GameScore.Application.Auth;
using GameScore.Application.Configuration;
using GameScore.Application.Errors;
using GameScore.Domain.Enums;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;

namespace GameScore.Api.Authorization;

public static class AuthExtensions
{
    public static IServiceCollection AddGameScoreAuth(this IServiceCollection services, AppConfig config)
    {
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                // Keep JWT claim names as issued (role, sub, type). Default inbound
                // mapping rewrites "role" to ClaimTypes.Role and breaks MinimumRole.
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config.Jwt.AccessSecret)),
                    ClockSkew = TimeSpan.FromSeconds(30),
                    NameClaimType = "sub",
                    RoleClaimType = "role",
                };

                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = context =>
                    {
                        var type = context.Principal?.FindFirst("type")?.Value;
                        if (type != "access")
                        {
                            context.Fail("Wrong token type");
                        }

                        return Task.CompletedTask;
                    },
                };
            });

        services.AddAuthorization(options => options.AddGameScorePolicies());
        services.AddSingleton<IAuthorizationHandler, MinimumRoleHandler>();
        return services;
    }

    public static AuthUser? GetAuthUser(this ClaimsPrincipal user)
    {
        if (user.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        var sub = user.FindFirst("sub")?.Value
            ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (sub is null || !Guid.TryParse(sub, out var id))
        {
            return null;
        }

        return new AuthUser(
            id,
            user.FindFirst("username")?.Value ?? "",
            ResolveRole(user),
            int.TryParse(user.FindFirst("reputationScore")?.Value, out var rep) ? rep : 0);
    }

    private static string ResolveRole(ClaimsPrincipal user) =>
        user.FindFirst("role")?.Value
        ?? user.FindFirst(ClaimTypes.Role)?.Value
        ?? UserRoles.User;
}

public sealed class MinimumRoleAttribute : AuthorizeAttribute
{
    public MinimumRoleAttribute(string role)
    {
        Policy = $"MinimumRole:{role}";
    }
}

public sealed class MinimumRoleRequirement(string minimumRole) : IAuthorizationRequirement
{
    public string MinimumRole { get; } = minimumRole;
}

public sealed class MinimumRoleHandler : AuthorizationHandler<MinimumRoleRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, MinimumRoleRequirement requirement)
    {
        var role = context.User.FindFirst("role")?.Value
            ?? context.User.FindFirst(ClaimTypes.Role)?.Value
            ?? UserRoles.User;
        var requiredRank = UserRoles.RoleRank(requirement.MinimumRole);
        var userRank = UserRoles.RoleRank(role);
        if (userRank >= requiredRank)
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        context.Fail(new AuthorizationFailureReason(this, ErrorCodes.InsufficientRole));
        return Task.CompletedTask;
    }
}

public static class AuthorizationPolicyExtensions
{
    public static void AddGameScorePolicies(this AuthorizationOptions options)
    {
        foreach (var role in UserRoles.All)
        {
            options.AddPolicy(
                $"MinimumRole:{role}",
                policy => policy.Requirements.Add(new MinimumRoleRequirement(role)));
        }
    }
}
