namespace GameScore.Infrastructure.Integrations;

public static class CdnImageRules
{
    private static readonly HashSet<string> AllowedHosts =
    [
        "images.igdb.com",
        "cdn.cloudflare.steamstatic.com",
        "placehold.co",
    ];

    public static bool IsAllowedImageUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        if (!Uri.TryCreate(value, UriKind.Absolute, out var url))
        {
            return false;
        }

        return url.Scheme == Uri.UriSchemeHttps && AllowedHosts.Contains(url.Host);
    }

    public static string? NormaliseIgdbImageUrl(string? url, string size)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return null;
        }

        var absolute = url.StartsWith("//", StringComparison.Ordinal) ? $"https:{url}" : url;
        // IGDB serves size via the Cloudinary-style /t_<size>/ segment.
        var upgraded = System.Text.RegularExpressions.Regex.Replace(
            absolute,
            @"/t_[^/]+/",
            $"/t_{size}/");
        return IsAllowedImageUrl(upgraded) ? upgraded : null;
    }
}

public sealed class CdnImageProvider
{
    // cover_big is only 264px wide and looks soft on retina search/catalogue cards;
    // 720p yields ~540×720 for portrait covers.
    public string? CoverUrl(string? raw) => CdnImageRules.NormaliseIgdbImageUrl(raw, "720p");

    public string? BannerUrl(string? raw) => CdnImageRules.NormaliseIgdbImageUrl(raw, "screenshot_huge");

    public IReadOnlyList<string> GalleryUrls(IEnumerable<string?> raws, int limit = 12)
    {
        var urls = new List<string>();
        var seen = new HashSet<string>();
        foreach (var raw in raws)
        {
            var url = CdnImageRules.NormaliseIgdbImageUrl(raw, "screenshot_huge");
            if (url is null || !seen.Add(url))
            {
                continue;
            }

            urls.Add(url);
            if (urls.Count >= limit)
            {
                break;
            }
        }

        return urls;
    }
}
