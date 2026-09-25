using System.Text;
using System.Text.Json;
using GameScore.Application.Errors;

namespace GameScore.Application.Http;

public static class Pagination
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 50;
    public const int DefaultCursorSize = 20;
    public const int MaxCursorSize = 50;

    public static int ClampPage(int? page) =>
        page is null or <= 0 ? 1 : page.Value;

    public static int ClampLimit(int? limit, int fallback = DefaultPageSize)
    {
        if (limit is null or <= 0)
        {
            return fallback;
        }

        return Math.Min(MaxPageSize, Math.Max(1, limit.Value));
    }

    public static object PageMeta(int total, int page, int limit)
    {
        var totalPages = total == 0 ? 0 : (int)Math.Ceiling(total / (double)limit);
        return new
        {
            page,
            limit,
            total,
            totalPages,
            hasNextPage = page < totalPages,
        };
    }

    public static object Paginated<T>(IReadOnlyList<T> items, int total, int page, int limit) =>
        new { items, meta = PageMeta(total, page, limit) };

    public static string EncodeCursor(object payload) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload)))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

    public static T DecodeCursor<T>(string cursor)
    {
        try
        {
            var padded = cursor.Replace('-', '+').Replace('_', '/');
            switch (padded.Length % 4)
            {
                case 2: padded += "=="; break;
                case 3: padded += "="; break;
            }

            var json = Encoding.UTF8.GetString(Convert.FromBase64String(padded));
            return JsonSerializer.Deserialize<T>(json)!;
        }
        catch
        {
            throw new BadRequestException(ErrorCodes.InvalidCursor, "Invalid pagination cursor");
        }
    }

    public static object CursorMeta(int limit, string? nextCursor) =>
        new
        {
            limit,
            nextCursor,
            hasNextPage = nextCursor is not null,
        };
}
