using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace GameScore.Domain.Utils;

public static partial class Slug
{
    public const int MaxLength = 80;

    public static string Slugify(string input)
    {
        var normalised = input
            .Normalize(NormalizationForm.FormKD)
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            .Aggregate(new StringBuilder(), (sb, c) => sb.Append(c))
            .ToString()
            .Replace("&", " and ", StringComparison.Ordinal)
            .Replace("'", "", StringComparison.Ordinal)
            .Replace("’", "", StringComparison.Ordinal)
            .ToLowerInvariant();

        normalised = NonAlphanumeric().Replace(normalised, "-");
        normalised = EdgeDashes().Replace(normalised, "");
        if (normalised.Length > MaxLength)
        {
            normalised = normalised[..MaxLength];
        }

        return EdgeDashes().Replace(normalised, "");
    }

    public static string UniqueSlug(string input, Func<string, bool> isTaken)
    {
        var baseSlug = Slugify(input);
        if (string.IsNullOrEmpty(baseSlug))
        {
            baseSlug = "game";
        }

        if (!isTaken(baseSlug))
        {
            return baseSlug;
        }

        for (var suffix = 2; suffix < 1000; suffix++)
        {
            var suffixText = suffix.ToString(CultureInfo.InvariantCulture);
            var maxBase = MaxLength - suffixText.Length - 1;
            var truncated = baseSlug.Length <= maxBase ? baseSlug : baseSlug[..maxBase];
            var candidate = $"{truncated}-{suffixText}";
            if (!isTaken(candidate))
            {
                return candidate;
            }
        }

        throw new InvalidOperationException($"Unable to derive a unique slug for \"{input}\"");
    }

    public static bool IsValid(string value) =>
        ValidSlug().IsMatch(value) && value.Length <= MaxLength;

    [GeneratedRegex(@"[^a-z0-9]+")]
    private static partial Regex NonAlphanumeric();

    [GeneratedRegex(@"^-+|-+$")]
    private static partial Regex EdgeDashes();

    [GeneratedRegex(@"^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    private static partial Regex ValidSlug();
}
