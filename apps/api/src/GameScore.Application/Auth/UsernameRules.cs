using System.Text.RegularExpressions;
using GameScore.Application.Errors;

namespace GameScore.Application.Auth;

/// <summary>
/// Mirrors the Postgres check constraint <c>users_username_format_check</c>:
/// <c>username ~ '^[a-z0-9_]{3,30}$'</c>.
/// </summary>
public static partial class UsernameRules
{
    public const int MinLength = 3;
    public const int MaxLength = 30;

    public static void EnsureValid(string? username)
    {
        if (string.IsNullOrWhiteSpace(username) || !Format().IsMatch(username))
        {
            throw new BadRequestException(
                ErrorCodes.ValidationFailed,
                $"Username must be {MinLength}-{MaxLength} characters: lowercase letters, digits, and underscores only");
        }
    }

    [GeneratedRegex(@"^[a-z0-9_]{3,30}$", RegexOptions.CultureInvariant)]
    private static partial Regex Format();
}
