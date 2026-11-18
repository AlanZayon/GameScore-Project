using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace GameScore.Domain.Moderation;

public static partial class TextHelpers
{
    public static string NormaliseForComparison(string text)
    {
        var normalised = text
            .Normalize(NormalizationForm.FormKD)
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            .Aggregate(new StringBuilder(), (sb, c) => sb.Append(c))
            .ToString()
            .ToLowerInvariant();

        normalised = NonAlphanumeric().Replace(normalised, "");
        normalised = Whitespace().Replace(normalised, " ").Trim();
        return normalised;
    }

    /// <summary>
    /// Unique alphanumeric characters over a capped length. Using raw
    /// unique/length wrongly rejects long natural reviews (ratio falls as
    /// text grows) while only padding like "aaaa…" should fail.
    /// </summary>
    public static double CharacterDiversity(string text)
    {
        var stripped = NormaliseForComparison(text).Replace(" ", "", StringComparison.Ordinal);
        if (stripped.Length == 0) return 0;
        var unique = stripped.Distinct().Count();
        var denominator = Math.Min(stripped.Length, 36);
        return unique / (double)denominator;
    }

    public static double ShoutingRatio(string text)
    {
        var letters = LettersOnly().Replace(text, "");
        if (letters.Length == 0) return 0;
        var uppercase = letters.Count(char.IsUpper);
        return uppercase / (double)letters.Length;
    }

    public static int WordCount(string text)
    {
        var normalised = NormaliseForComparison(text);
        if (normalised.Length == 0) return 0;
        return normalised.Split(' ').Length;
    }

    [GeneratedRegex(@"[^a-z0-9\s]")]
    private static partial Regex NonAlphanumeric();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    [GeneratedRegex(@"[^a-zA-Z]")]
    private static partial Regex LettersOnly();
}
