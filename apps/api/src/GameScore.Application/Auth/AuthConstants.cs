namespace GameScore.Application.Auth;

public static class AuthConstants
{
    public const string RefreshTokenCookie = "gs_refresh_token";
}

public sealed record AuthUser(Guid Id, string Username, string Role, int ReputationScore);

public sealed record AccessTokenPayload(string Sub, string Username, string Role, string Type);

public sealed record RefreshTokenPayload(string Sub, string Jti, string Type);

public sealed record IssuedRefreshToken(string Token, DateTime ExpiresAt);

public sealed record AuthSessionResponse(
    string AccessToken,
    int ExpiresIn,
    AuthenticatedUserDto User);

public sealed record AuthenticatedUserDto(
    Guid Id,
    string Email,
    string Username,
    string? DisplayName,
    string Role,
    string Status,
    int ReputationScore,
    string? AvatarUrl,
    string? Bio,
    DateTime? EmailVerifiedAt,
    DateTime CreatedAt);
