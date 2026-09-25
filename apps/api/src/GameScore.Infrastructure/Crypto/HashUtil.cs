using System.Security.Cryptography;
using System.Text;

namespace GameScore.Infrastructure.Crypto;

public static class HashUtil
{
    public static string Sha256Hex(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public static string? HashClientIp(string? ip, string secret)
    {
        if (string.IsNullOrWhiteSpace(ip))
        {
            return null;
        }

        var normalised = ip.Replace("::ffff:", "", StringComparison.Ordinal).Trim();
        if (normalised.Length == 0 || normalised.Equals("unknown", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return Sha256Hex($"{secret}:ip:{normalised}");
    }

    public static string ReviewFingerprint(string text) =>
        Sha256Hex(GameScore.Domain.Moderation.TextHelpers.NormaliseForComparison(text));
}

public static class DateHelpers
{
    public static DateOnly UtcDate(DateTime value = default) =>
        DateOnly.FromDateTime((value == default ? DateTime.UtcNow : value).ToUniversalTime());

    public static string IsoDate(DateOnly date) => date.ToString("yyyy-MM-dd");

    public static string IsoDate(DateTime value) => IsoDate(UtcDate(value));
}
