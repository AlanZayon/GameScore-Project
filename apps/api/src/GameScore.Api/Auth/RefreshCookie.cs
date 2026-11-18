using GameScore.Application.Auth;
using GameScore.Application.Configuration;

namespace GameScore.Api.Auth;

public static class RefreshCookie
{
    /// <summary>
    /// Production uses SameSite=None so the Vercel web origin can refresh against
    /// the Render API over HTTPS. Localhost keeps Lax without Secure.
    /// </summary>
    public static CookieOptions CreateOptions(AppConfig config, DateTimeOffset? expires = null)
    {
        var options = new CookieOptions
        {
            HttpOnly = true,
            Path = "/",
            SameSite = config.IsProduction ? SameSiteMode.None : SameSiteMode.Lax,
            Secure = config.IsProduction,
        };

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
}
