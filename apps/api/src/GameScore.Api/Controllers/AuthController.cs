using GameScore.Api.Authorization;
using GameScore.Application.Auth;
using GameScore.Application.Configuration;
using GameScore.Infrastructure.Auth;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace GameScore.Api.Controllers;

[ApiController]
[Route("auth")]
public sealed class AuthController(AuthService auth, IOptions<AppConfig> config) : ControllerBase
{
    [HttpPost("register")]
    [ProducesResponseType(typeof(AuthSessionResponse), StatusCodes.Status201Created)]
    public async Task<ActionResult<AuthSessionResponse>> Register([FromBody] RegisterRequest body, CancellationToken cancellationToken)
    {
        var result = await auth.RegisterAsync(
            body.Email,
            body.Username,
            body.Password,
            body.DisplayName,
            Request.Headers.UserAgent,
            cancellationToken);
        SetRefreshCookie(result.RefreshToken);
        return Created(string.Empty, result.Session);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthSessionResponse>> Login([FromBody] LoginRequest body, CancellationToken cancellationToken)
    {
        var result = await auth.LoginAsync(body.Identifier, body.Password, Request.Headers.UserAgent, cancellationToken);
        SetRefreshCookie(result.RefreshToken);
        return Ok(result.Session);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthSessionResponse>> Refresh(CancellationToken cancellationToken)
    {
        if (!Request.Cookies.TryGetValue(AuthConstants.RefreshTokenCookie, out var token))
        {
            throw new Application.Errors.UnauthorizedException(
                Application.Errors.ErrorCodes.InvalidRefreshToken,
                "No refresh token provided");
        }

        try
        {
            var result = await auth.RefreshAsync(token, Request.Headers.UserAgent, cancellationToken);
            SetRefreshCookie(result.RefreshToken);
            return Ok(result.Session);
        }
        catch (Application.Errors.UnauthorizedException)
        {
            ClearRefreshCookie();
            throw;
        }
    }

    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        Request.Cookies.TryGetValue(AuthConstants.RefreshTokenCookie, out var token);
        await auth.LogoutAsync(token, cancellationToken);
        ClearRefreshCookie();
        return NoContent();
    }

    [HttpGet("me")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<ActionResult<AuthenticatedUserDto>> Me(CancellationToken cancellationToken)
    {
        var user = HttpContext.User.GetAuthUser()
            ?? throw new Application.Errors.UnauthorizedException();
        return Ok(await auth.CurrentUserAsync(user.Id, cancellationToken));
    }

    [HttpPost("password")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest body, CancellationToken cancellationToken)
    {
        var user = HttpContext.User.GetAuthUser()
            ?? throw new Application.Errors.UnauthorizedException();
        await auth.ChangePasswordAsync(user.Id, body.CurrentPassword, body.NewPassword, cancellationToken);
        return NoContent();
    }

    [HttpPost("forgot-password")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest body, CancellationToken cancellationToken)
    {
        await auth.ForgotPasswordAsync(body.Email, cancellationToken);
        return NoContent();
    }

    [HttpPost("reset-password")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest body, CancellationToken cancellationToken)
    {
        await auth.ResetPasswordAsync(body.Token, body.Password, cancellationToken);
        return NoContent();
    }

    [HttpPost("verify-email")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest body, CancellationToken cancellationToken)
    {
        await auth.VerifyEmailAsync(body.Token, cancellationToken);
        return NoContent();
    }

    [HttpPost("resend-verification")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationRequest body, CancellationToken cancellationToken)
    {
        await auth.ResendVerificationAsync(body.Email, cancellationToken);
        return NoContent();
    }

    private void SetRefreshCookie(IssuedRefreshToken refresh)
    {
        Response.Cookies.Append(
            AuthConstants.RefreshTokenCookie,
            refresh.Token,
            new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                Secure = config.Value.IsProduction,
                Path = "/",
                Expires = refresh.ExpiresAt,
            });
    }

    private void ClearRefreshCookie()
    {
        Response.Cookies.Delete(
            AuthConstants.RefreshTokenCookie,
            new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                Secure = config.Value.IsProduction,
                Path = "/",
            });
    }
}

public sealed record RegisterRequest(string Email, string Username, string Password, string? DisplayName, bool AcceptedTerms);
public sealed record LoginRequest(string Identifier, string Password);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public sealed record ForgotPasswordRequest(string Email);
public sealed record ResetPasswordRequest(string Token, string Password);
public sealed record VerifyEmailRequest(string Token);
public sealed record ResendVerificationRequest(string Email);
