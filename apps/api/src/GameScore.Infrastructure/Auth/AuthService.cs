using System.Security.Cryptography;
using GameScore.Application.Auth;
using GameScore.Application.Configuration;
using GameScore.Application.Errors;
using GameScore.Infrastructure.Crypto;
using GameScore.Infrastructure.Email;
using GameScore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace GameScore.Infrastructure.Auth;

public sealed class AuthService
{
    private readonly GameScoreDbContext _db;
    private readonly PasswordHasher _hasher;
    private readonly TokenService _tokens;
    private readonly AppConfig _config;
    private readonly IEmailSender _email;
    private readonly ILogger<AuthService> _logger;
    private string? _decoyHash;

    public AuthService(
        GameScoreDbContext db,
        PasswordHasher hasher,
        TokenService tokens,
        IOptions<AppConfig> config,
        IEmailSender email,
        ILogger<AuthService> logger)
    {
        _db = db;
        _hasher = hasher;
        _tokens = tokens;
        _config = config.Value;
        _email = email;
        _logger = logger;
    }

    public async Task<(AuthSessionResponse Session, IssuedRefreshToken RefreshToken)> RegisterAsync(
        string email,
        string username,
        string password,
        string? displayName,
        string? userAgent,
        CancellationToken cancellationToken = default)
    {
        email = email.Trim().ToLowerInvariant();
        username = username.Trim().ToLowerInvariant();

        if (await _db.Users.AnyAsync(u => u.Email == email, cancellationToken))
        {
            throw new ConflictException(ErrorCodes.EmailAlreadyInUse, "That email is already registered");
        }

        if (await _db.Users.AnyAsync(u => u.Username == username, cancellationToken))
        {
            throw new ConflictException(ErrorCodes.UsernameAlreadyInUse, "That username is already taken");
        }

        var now = DateTime.UtcNow;
        var user = new UserEntity
        {
            Id = Guid.NewGuid(),
            Email = email,
            Username = username,
            DisplayName = string.IsNullOrWhiteSpace(displayName) ? null : displayName.Trim(),
            PasswordHash = await _hasher.HashAsync(password, cancellationToken),
            Role = DbUserRole.USER,
            Status = DbUserStatus.ACTIVE,
            TermsAcceptedAt = now,
            CreatedAt = now,
            UpdatedAt = now,
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("New account registered: {Username}", user.Username);
        await SendVerificationEmailAsync(user.Id, user.Email, cancellationToken);

        return await BuildSessionAsync(user, userAgent, cancellationToken);
    }

    public async Task<(AuthSessionResponse Session, IssuedRefreshToken RefreshToken)> LoginAsync(
        string identifier,
        string password,
        string? userAgent,
        CancellationToken cancellationToken = default)
    {
        var normalized = identifier.Trim().ToLowerInvariant();
        var user = await _db.Users
            .FirstOrDefaultAsync(
                u => u.Email == normalized || u.Username == normalized,
                cancellationToken);

        if (user is null)
        {
            await _hasher.VerifyAsync(await GetDecoyHashAsync(cancellationToken), password, cancellationToken);
            throw new UnauthorizedException(ErrorCodes.InvalidCredentials, "Invalid credentials");
        }

        if (!await _hasher.VerifyAsync(user.PasswordHash, password, cancellationToken))
        {
            throw new UnauthorizedException(ErrorCodes.InvalidCredentials, "Invalid credentials");
        }

        await AssertUsableAsync(user, cancellationToken);
        return await BuildSessionAsync(user, userAgent, cancellationToken);
    }

    public async Task<(AuthSessionResponse Session, IssuedRefreshToken RefreshToken)> RefreshAsync(
        string rawRefreshToken,
        string? userAgent,
        CancellationToken cancellationToken = default)
    {
        var (userId, refreshToken) = await _tokens.RotateRefreshTokenAsync(rawRefreshToken, userAgent, cancellationToken);
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            throw new UnauthorizedException(ErrorCodes.InvalidRefreshToken, "Account no longer exists");
        }

        await AssertUsableAsync(user, cancellationToken);
        var accessToken = _tokens.SignAccessToken(
            user.Id,
            user.Username,
            user.Role.ToString(),
            user.ReputationScore);
        return (
            new AuthSessionResponse(
                accessToken,
                _config.Jwt.AccessTtlSeconds,
                UserMapper.ToAuthenticatedUser(user)),
            refreshToken);
    }

    public Task LogoutAsync(string? rawRefreshToken, CancellationToken cancellationToken = default) =>
        string.IsNullOrEmpty(rawRefreshToken)
            ? Task.CompletedTask
            : _tokens.RevokeRefreshTokenAsync(rawRefreshToken, cancellationToken);

    public async Task<AuthenticatedUserDto> CurrentUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            throw new NotFoundException(ErrorCodes.UserNotFound, "Account not found");
        }

        return UserMapper.ToAuthenticatedUser(user);
    }

    public async Task ChangePasswordAsync(
        Guid userId,
        string currentPassword,
        string newPassword,
        CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            throw new NotFoundException(ErrorCodes.UserNotFound, "Account not found");
        }

        if (!await _hasher.VerifyAsync(user.PasswordHash, currentPassword, cancellationToken))
        {
            throw new UnauthorizedException(ErrorCodes.CurrentPasswordInvalid, "Current password is wrong");
        }

        user.PasswordHash = await _hasher.HashAsync(newPassword, cancellationToken);
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await _tokens.RevokeAllForUserAsync(userId, cancellationToken);
    }

    public async Task ForgotPasswordAsync(string email, CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(
            u => u.Email == email.Trim().ToLowerInvariant(),
            cancellationToken);
        if (user is null || user.DeletedAt is not null)
        {
            await _hasher.VerifyAsync(await GetDecoyHashAsync(cancellationToken), "gamescore-decoy-password", cancellationToken);
            return;
        }

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var expiresAt = DateTime.UtcNow.AddHours(1);
        await _db.PasswordResetTokens
            .Where(t => t.UserId == user.Id && t.UsedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, DateTime.UtcNow), cancellationToken);

        _db.PasswordResetTokens.Add(new PasswordResetTokenEntity
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = HashUtil.Sha256Hex(token),
            ExpiresAt = expiresAt,
            CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync(cancellationToken);

        var resetUrl = $"{_config.WebUrl.TrimEnd('/')}/reset-password?token={token}";
        await DeliverEmailAsync(
            user.Email,
            "Redefinir senha — GameScore",
            $"Redefina sua senha do GameScore com este link (válido por uma hora):\n{resetUrl}\n\n" +
            $"Reset your GameScore password with this link (valid for one hour):\n{resetUrl}\n",
            cancellationToken);
    }

    public async Task ResetPasswordAsync(string token, string newPassword, CancellationToken cancellationToken = default)
    {
        var stored = await _db.PasswordResetTokens
            .FirstOrDefaultAsync(t => t.TokenHash == HashUtil.Sha256Hex(token), cancellationToken);
        if (stored is null || stored.UsedAt is not null)
        {
            throw new UnauthorizedException(ErrorCodes.InvalidResetToken, "Reset token is not valid");
        }

        if (stored.ExpiresAt <= DateTime.UtcNow)
        {
            throw new UnauthorizedException(ErrorCodes.ResetTokenExpired, "Reset token has expired");
        }

        var passwordHash = await _hasher.HashAsync(newPassword, cancellationToken);
        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        stored.UsedAt = DateTime.UtcNow;
        var user = await _db.Users.FirstAsync(u => u.Id == stored.UserId, cancellationToken);
        user.PasswordHash = passwordHash;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        await _tokens.RevokeAllForUserAsync(stored.UserId, cancellationToken);
    }

    public async Task VerifyEmailAsync(string token, CancellationToken cancellationToken = default)
    {
        var stored = await _db.EmailVerificationTokens
            .FirstOrDefaultAsync(t => t.TokenHash == HashUtil.Sha256Hex(token), cancellationToken);
        if (stored is null || stored.UsedAt is not null)
        {
            throw new UnauthorizedException(ErrorCodes.InvalidVerificationToken, "Verification token is not valid");
        }

        if (stored.ExpiresAt <= DateTime.UtcNow)
        {
            throw new UnauthorizedException(ErrorCodes.VerificationTokenExpired, "Verification token has expired");
        }

        stored.UsedAt = DateTime.UtcNow;
        var user = await _db.Users.FirstAsync(u => u.Id == stored.UserId, cancellationToken);
        user.EmailVerifiedAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task ResendVerificationAsync(string email, CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(
            u => u.Email == email.Trim().ToLowerInvariant(),
            cancellationToken);
        if (user is null || user.DeletedAt is not null || user.EmailVerifiedAt is not null)
        {
            await _hasher.VerifyAsync(await GetDecoyHashAsync(cancellationToken), "gamescore-decoy-password", cancellationToken);
            return;
        }

        await SendVerificationEmailAsync(user.Id, user.Email, cancellationToken);
    }

    private async Task SendVerificationEmailAsync(Guid userId, string email, CancellationToken cancellationToken)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var expiresAt = DateTime.UtcNow.AddHours(24);
        await _db.EmailVerificationTokens
            .Where(t => t.UserId == userId && t.UsedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, DateTime.UtcNow), cancellationToken);

        _db.EmailVerificationTokens.Add(new EmailVerificationTokenEntity
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = HashUtil.Sha256Hex(token),
            ExpiresAt = expiresAt,
            CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync(cancellationToken);

        var verifyUrl = $"{_config.WebUrl.TrimEnd('/')}/verify-email?token={token}";
        await DeliverEmailAsync(
            email,
            "Confirme seu e-mail — GameScore",
            $"Confirme seu e-mail do GameScore com este link (válido por 24 horas):\n{verifyUrl}\n\n" +
            $"Confirm your GameScore email with this link (valid for 24 hours):\n{verifyUrl}\n",
            cancellationToken);
    }

    private async Task DeliverEmailAsync(string to, string subject, string text, CancellationToken cancellationToken)
    {
        try
        {
            await _email.SendAsync(new EmailMessage(to, subject, text), cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {To}", to);
        }
    }

    private async Task<(AuthSessionResponse Session, IssuedRefreshToken RefreshToken)> BuildSessionAsync(
        UserEntity user,
        string? userAgent,
        CancellationToken cancellationToken)
    {
        await AssertUsableAsync(user, cancellationToken);
        var accessToken = _tokens.SignAccessToken(
            user.Id,
            user.Username,
            user.Role.ToString(),
            user.ReputationScore);
        var refresh = await _tokens.IssueRefreshTokenAsync(user.Id, userAgent, cancellationToken);
        return (
            new AuthSessionResponse(
                accessToken,
                _config.Jwt.AccessTtlSeconds,
                UserMapper.ToAuthenticatedUser(user)),
            refresh);
    }

    private async Task AssertUsableAsync(UserEntity user, CancellationToken cancellationToken)
    {
        if (user.DeletedAt is not null)
        {
            throw new UnauthorizedException(ErrorCodes.InvalidCredentials, "Invalid credentials");
        }

        if (user.Status != DbUserStatus.SUSPENDED)
        {
            return;
        }

        if (user.SuspendedUntil is not null && user.SuspendedUntil <= DateTime.UtcNow)
        {
            user.Status = DbUserStatus.ACTIVE;
            user.SuspendedUntil = null;
            user.SuspensionReason = null;
            user.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
            return;
        }

        var message = user.SuspendedUntil is not null
            ? $"Account suspended until {user.SuspendedUntil:O}"
            : "Account suspended";
        throw new ForbiddenException(ErrorCodes.AccountSuspended, message);
    }

    private async Task<string> GetDecoyHashAsync(CancellationToken cancellationToken)
    {
        if (_decoyHash is not null)
        {
            return _decoyHash;
        }

        _decoyHash = await _hasher.HashAsync("gamescore-decoy-password", cancellationToken);
        return _decoyHash;
    }
}

internal static class UserMapper
{
    public static AuthenticatedUserDto ToAuthenticatedUser(UserEntity user) =>
        new(
            user.Id,
            user.Email,
            user.Username,
            user.DisplayName,
            user.Role.ToString(),
            user.Status.ToString(),
            user.ReputationScore,
            user.AvatarUrl,
            user.Bio,
            user.EmailVerifiedAt,
            user.CreatedAt);
}
