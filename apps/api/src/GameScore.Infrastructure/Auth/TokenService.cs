using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using GameScore.Application.Auth;
using GameScore.Application.Configuration;
using GameScore.Application.Errors;
using GameScore.Infrastructure.Crypto;
using GameScore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace GameScore.Infrastructure.Auth;

public sealed class TokenService
{
    private readonly AppConfig _config;
    private readonly GameScoreDbContext _db;
    private readonly ILogger<TokenService> _logger;

    public TokenService(IOptions<AppConfig> config, GameScoreDbContext db, ILogger<TokenService> logger)
    {
        _config = config.Value;
        _db = db;
        _logger = logger;
    }

    public string SignAccessToken(Guid userId, string username, string role, int reputationScore)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config.Jwt.AccessSecret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim("username", username),
            new Claim("role", role),
            new Claim("reputationScore", reputationScore.ToString()),
            new Claim("type", "access"),
        };

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddSeconds(_config.Jwt.AccessTtlSeconds),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public AccessTokenPayload VerifyAccessToken(string token)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config.Jwt.AccessSecret));
            var principal = handler.ValidateToken(
                token,
                new TokenValidationParameters
                {
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = key,
                    ClockSkew = TimeSpan.FromSeconds(30),
                },
                out _);

            var type = principal.FindFirst("type")?.Value;
            if (type != "access")
            {
                throw new UnauthorizedException(ErrorCodes.Unauthorized, "Wrong token type");
            }

            var sub = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (sub is null)
            {
                throw new UnauthorizedException(ErrorCodes.Unauthorized, "Invalid access token");
            }

            return new AccessTokenPayload(
                sub,
                principal.FindFirst("username")?.Value ?? "",
                principal.FindFirst("role")?.Value ?? "USER",
                "access");
        }
        catch (SecurityTokenExpiredException)
        {
            throw new UnauthorizedException(ErrorCodes.AccessTokenExpired, "Access token expired");
        }
        catch (UnauthorizedException)
        {
            throw;
        }
        catch
        {
            throw new UnauthorizedException(ErrorCodes.Unauthorized, "Invalid access token");
        }
    }

    public async Task<IssuedRefreshToken> IssueRefreshTokenAsync(
        Guid userId,
        string? userAgent,
        CancellationToken cancellationToken = default)
    {
        var jti = Guid.NewGuid();
        var ttlSeconds = _config.Jwt.RefreshTtlSeconds;
        var token = SignRefreshJwt(userId, jti, ttlSeconds);
        var expiresAt = DateTime.UtcNow.AddSeconds(ttlSeconds);

        _db.RefreshTokens.Add(new RefreshTokenEntity
        {
            Id = jti,
            UserId = userId,
            TokenHash = HashUtil.Sha256Hex(token),
            ExpiresAt = expiresAt,
            CreatedAt = DateTime.UtcNow,
            UserAgent = userAgent is null ? null : userAgent[..Math.Min(userAgent.Length, 255)],
        });
        await _db.SaveChangesAsync(cancellationToken);

        return new IssuedRefreshToken(token, expiresAt);
    }

    public async Task<(Guid UserId, IssuedRefreshToken RefreshToken)> RotateRefreshTokenAsync(
        string rawToken,
        string? userAgent,
        CancellationToken cancellationToken = default)
    {
        var payload = VerifyRefreshJwt(rawToken);
        var tokenHash = HashUtil.Sha256Hex(rawToken);

        var stored = await _db.RefreshTokens
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);

        if (stored is null)
        {
            if (Guid.TryParse(payload.Sub, out var missingUserId))
            {
                await RevokeAllForUserAsync(missingUserId, cancellationToken);
            }

            _logger.LogWarning("Refresh token for user {UserId} was not found; all sessions revoked.", payload.Sub);
            throw new UnauthorizedException(ErrorCodes.InvalidRefreshToken, "Refresh token is not valid");
        }

        if (stored.RevokedAt is not null)
        {
            await RevokeAllForUserAsync(stored.UserId, cancellationToken);
            _logger.LogWarning("Reuse of a revoked refresh token by user {UserId}; all sessions revoked.", stored.UserId);
            throw new UnauthorizedException(ErrorCodes.InvalidRefreshToken, "Refresh token has already been used");
        }

        if (stored.ExpiresAt <= DateTime.UtcNow)
        {
            throw new UnauthorizedException(ErrorCodes.InvalidRefreshToken, "Refresh token has expired");
        }

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        await _db.RefreshTokens
            .Where(t => t.Id == stored.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow), cancellationToken);

        var refresh = await IssueRefreshTokenAsync(stored.UserId, userAgent, cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return (stored.UserId, refresh);
    }

    public async Task RevokeRefreshTokenAsync(string rawToken, CancellationToken cancellationToken = default)
    {
        var hash = HashUtil.Sha256Hex(rawToken);
        await _db.RefreshTokens
            .Where(t => t.TokenHash == hash && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow), cancellationToken);
    }

    public async Task RevokeAllForUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        await _db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow), cancellationToken);
    }

    public async Task<int> DeleteExpiredTokensAsync(CancellationToken cancellationToken = default)
    {
        return await _db.RefreshTokens
            .Where(t => t.ExpiresAt < DateTime.UtcNow)
            .ExecuteDeleteAsync(cancellationToken);
    }

    private string SignRefreshJwt(Guid userId, Guid jti, int ttlSeconds)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config.Jwt.RefreshSecret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, jti.ToString()),
            new Claim("type", "refresh"),
        };

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddSeconds(ttlSeconds),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private RefreshTokenPayload VerifyRefreshJwt(string token)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config.Jwt.RefreshSecret));
            var principal = handler.ValidateToken(
                token,
                new TokenValidationParameters
                {
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = key,
                    ClockSkew = TimeSpan.FromSeconds(30),
                },
                out _);

            if (principal.FindFirst("type")?.Value != "refresh")
            {
                throw new UnauthorizedException(ErrorCodes.InvalidRefreshToken, "Wrong token type");
            }

            var sub = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
            var jti = principal.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;
            if (sub is null || jti is null || !Guid.TryParse(sub, out var userId))
            {
                throw new UnauthorizedException(ErrorCodes.InvalidRefreshToken, "Refresh token is not valid");
            }

            return new RefreshTokenPayload(sub, jti, "refresh");
        }
        catch (UnauthorizedException)
        {
            throw;
        }
        catch
        {
            throw new UnauthorizedException(ErrorCodes.InvalidRefreshToken, "Refresh token is not valid");
        }
    }
}
