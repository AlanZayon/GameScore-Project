using GameScore.Application.Auth;
using GameScore.Application.Configuration;
using Microsoft.AspNetCore.Http;

namespace GameScore.Api.Auth;

public static class RefreshCookie
{
    /// <summary>
    /// Cross-site browsers (web on gamesscore.com.br, API on onrender.com) need
    /// SameSite=None; Secure; Partitioned. Prefer a same-origin <c>/api</c> proxy
    /// (or api. subdomain) with COOKIE_SAMESITE=Lax so the cookie is first-party.
    /// </summary>
    public static CookieOptions CreateOptions(AppConfig config, DateTimeOffset? expires = null)
    {
        var sameSite = ResolveSameSite(config.CookieSameSite);
        var secure = config.IsProduction || sameSite == SameSiteMode.None;
        var options = new CookieOptions
        {
            HttpOnly = true,
            Path = "/",
            SameSite = sameSite,
            Secure = secure,
        };

        // CHIPS: keeps cross-site cookies usable when browsers restrict third-party cookies.
        if (sameSite == SameSiteMode.None && secure)
        {
            options.Extensions.Add("Partitioned");
        }

        if (expires is not null)
        {
            options.Expires = expires;
        }

        return options;
    }

    public static void Set(HttpResponse response, AppConfig config, IssuedRefreshToken refresh)
    {
        response.Cookies.Append(
            AuthConstants.RefreshTokenCookie,
            refresh.Token,
            CreateOptions(config, refresh.ExpiresAt));
    }

    public static void Clear(HttpResponse response, AppConfig config)
    {
        response.Cookies.Delete(
            AuthConstants.RefreshTokenCookie,
            CreateOptions(config));
    }

    internal static SameSiteMode ResolveSameSite(string? value) =>
        string.Equals(value, "None", StringComparison.OrdinalIgnoreCase)
            ? SameSiteMode.None
            : SameSiteMode.Lax;
}
