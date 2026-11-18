using System.Text.RegularExpressions;
using GameScore.Application.Errors;

namespace GameScore.Application.Auth;

public static partial class PasswordRules
{
    public const int MinimumLength = 8;

    public static void EnsureValid(string? password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < MinimumLength)
        {
            throw new BadRequestException(
                ErrorCodes.ValidationFailed,
                $"Password must be at least {MinimumLength} characters");
        }

        if (!HasLetter().IsMatch(password) || !HasDigit().IsMatch(password))
        {
            throw new BadRequestException(
                ErrorCodes.ValidationFailed,
                "Password must include at least one letter and one number");
        }
    }

    [GeneratedRegex(@"[A-Za-z]", RegexOptions.CultureInvariant)]
    private static partial Regex HasLetter();

    [GeneratedRegex(@"\d", RegexOptions.CultureInvariant)]
    private static partial Regex HasDigit();
}
