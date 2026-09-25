using GameScore.Application.Configuration;
using GameScore.Infrastructure.Games;
using GameScore.Infrastructure.Integrations;
using GameScore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace GameScore.Infrastructure.Search;

public sealed class PostgresSearchService
{
    private const int LocalThinThreshold = 3;
    private const int IgdbSearchLimit = 12;
    private const int IgdbAutocompleteMinChars = 3;

    private readonly GameScoreDbContext _db;
    private readonly AppConfig _config;
    private readonly IgdbClient _igdb;
    private readonly CdnImageProvider _images = new();
    private readonly ILogger<PostgresSearchService> _logger;

    public PostgresSearchService(
        GameScoreDbContext db,
        IOptions<AppConfig> config,
        IgdbClient igdb,
        ILogger<PostgresSearchService> logger)
    {
        _db = db;
        _config = config.Value;
        _igdb = igdb;
        _logger = logger;
    }

    public async Task<object> SearchAsync(
        string q,
        int page,
        int limit,
        string? platformSlug,
        string? genreSlug,
        CancellationToken cancellationToken = default)
    {
        var started = Environment.TickCount64;
        page = Math.Max(1, page);
        limit = Math.Clamp(limit, 1, 100);
        var term = (q ?? string.Empty).Trim();

        if (term.Length == 0)
        {
            return EmptyResult(term, page, limit, started);
        }

        var tsQuery = ToTsQuery(term);
        var like = $"%{EscapeLike(term)}%";
        var offset = (page - 1) * limit;

        var rows = await _db.Database.SqlQueryRaw<SearchRow>(
                """
                WITH scored AS (
                  SELECT
                    g.id,
                    (
                      COALESCE(ts_rank_cd(g."searchVector", to_tsquery('simple', {0})), 0) * 2
                      + similarity(lower(g.name), lower({1}))
                      + similarity(lower(coalesce(g.developer, '')), lower({1})) * 0.4
                      + similarity(lower(coalesce(g.publisher, '')), lower({1})) * 0.4
                    ) AS rank
                  FROM games g
                  WHERE (
                    g."searchVector" @@ to_tsquery('simple', {0})
                    OR lower(g.name) LIKE lower({2})
                    OR lower(g.slug) LIKE lower({2})
                    OR lower(coalesce(g.developer, '')) LIKE lower({2})
                    OR lower(coalesce(g.publisher, '')) LIKE lower({2})
                    OR similarity(lower(g.name), lower({1})) > 0.15
                  )
                  AND (
                    {3}::text IS NULL
                    OR EXISTS (
                      SELECT 1 FROM game_platforms gp
                      INNER JOIN platforms p ON p.id = gp."platformId"
                      WHERE gp."gameId" = g.id AND p.slug = {3}
                    )
                  )
                  AND (
                    {4}::text IS NULL
                    OR EXISTS (
                      SELECT 1 FROM game_genres gg
                      INNER JOIN genres ge ON ge.id = gg."genreId"
                      WHERE gg."gameId" = g.id AND ge.slug = {4}
                    )
                  )
                )
                SELECT id, rank, COUNT(*) OVER() AS total
                FROM scored
                WHERE rank > 0
                ORDER BY rank DESC, id ASC
                OFFSET {5} LIMIT {6}
                """,
                tsQuery,
                term,
                like,
                string.IsNullOrWhiteSpace(platformSlug) ? null : platformSlug.Trim(),
                string.IsNullOrWhiteSpace(genreSlug) ? null : genreSlug.Trim(),
                offset,
                limit)
            .ToListAsync(cancellationToken);

        var total = rows.Count > 0 ? (int)rows[0].Total : 0;
        var ids = rows.Select(r => r.Id).ToList();
        var gamesById = ids.Count == 0
            ? new Dictionary<Guid, GameEntity>()
            : await _db.Games.AsNoTracking()
                .Where(g => ids.Contains(g.Id))
                .Include(g => g.Statistics)
                .Include(g => g.Platforms).ThenInclude(gp => gp.Platform)
                .Include(g => g.Genres).ThenInclude(gg => gg.Genre)
                .ToDictionaryAsync(g => g.Id, cancellationToken);

        var minLabel = _config.Ranking.ScoreLabelMinimumReviews;
        var items = ids
            .Where(id => gamesById.ContainsKey(id))
            .Select(id => GameDtoMapper.ToSummary(gamesById[id], minLabel))
            .ToList();

        var sources = new List<string> { "local" };
        IReadOnlyList<ExternalHit> externalHits = [];

        var canFetchExternal = _igdb.IsConfigured
            && page == 1
            && string.IsNullOrWhiteSpace(platformSlug)
            && string.IsNullOrWhiteSpace(genreSlug)
            && items.Count < LocalThinThreshold
            && term.Length >= 2;

        if (canFetchExternal)
        {
            externalHits = await FetchExternalHitsAsync(term, IgdbSearchLimit, cancellationToken);
            if (externalHits.Count > 0)
            {
                sources.Add("igdb");
            }
        }

        return new
        {
            query = term,
            items,
            externalItems = externalHits.Select(h => new
            {
                h.ExternalId,
                provider = "IGDB",
                h.Name,
                h.CoverImageUrl,
                h.ReleaseYear,
                h.Summary,
            }).ToList(),
            total,
            page,
            limit,
            totalPages = total == 0 ? 0 : (int)Math.Ceiling(total / (double)limit),
            provider = "postgres",
            sources,
            tookMs = Environment.TickCount64 - started,
        };
    }

    public async Task<IReadOnlyList<object>> AutocompleteAsync(string q, int limit, CancellationToken cancellationToken = default)
    {
        var capped = Math.Clamp(limit, 1, 20);
        var term = q.Trim();
        if (term.Length < 2)
        {
            return [];
        }

        var likePrefix = $"{EscapeLike(term)}%";
        var likeContains = $"%{EscapeLike(term)}%";

        var rows = await _db.Database.SqlQueryRaw<AutocompleteRow>(
                """
                SELECT
                  g.id,
                  g.slug,
                  g.name,
                  g."coverImageUrl",
                  g."releaseDate",
                  s."positivePercentage",
                  s."totalReviews"
                FROM games g
                LEFT JOIN game_statistics s ON s."gameId" = g.id
                WHERE
                  lower(g.name) LIKE lower({0})
                  OR lower(g.name) LIKE lower({1})
                  OR lower(g.slug) LIKE lower({1})
                  OR similarity(lower(g.name), lower({2})) > 0.2
                ORDER BY
                  CASE WHEN lower(g.name) LIKE lower({0}) THEN 0 ELSE 1 END,
                  similarity(lower(g.name), lower({2})) DESC,
                  coalesce(s."totalReviews", 0) DESC
                LIMIT {3}
                """,
                likePrefix,
                likeContains,
                term,
                capped)
            .ToListAsync(cancellationToken);

        var local = rows.Select(row => (object)new
        {
            id = row.Id.ToString(),
            slug = (string?)row.Slug,
            name = row.Name,
            coverImageUrl = row.CoverImageUrl,
            releaseYear = row.ReleaseDate?.Year,
            positivePercentage = row.PositivePercentage,
            totalReviews = row.TotalReviews ?? 0,
            source = "local",
        }).ToList();

        if (!_igdb.IsConfigured || local.Count >= capped || term.Length < IgdbAutocompleteMinChars)
        {
            return local;
        }

        var remaining = capped - local.Count;
        var external = await FetchExternalHitsAsync(term, remaining + 4, cancellationToken);
        var localNames = rows.Select(r => r.Name.ToLowerInvariant()).ToHashSet();

        var extras = external
            .Where(hit => !localNames.Contains(hit.Name.ToLowerInvariant()))
            .Take(remaining)
            .Select(hit => (object)new
            {
                id = $"igdb:{hit.ExternalId}",
                slug = (string?)null,
                name = hit.Name,
                coverImageUrl = hit.CoverImageUrl,
                releaseYear = hit.ReleaseYear,
                positivePercentage = (double?)null,
                totalReviews = 0,
                source = "igdb",
                externalId = hit.ExternalId,
            });

        return local.Concat(extras).ToList();
    }

    private async Task<IReadOnlyList<ExternalHit>> FetchExternalHitsAsync(
        string term,
        int limit,
        CancellationToken cancellationToken)
    {
        if (term.Length < 2 || !_igdb.IsConfigured)
        {
            return [];
        }

        try
        {
            var matches = await _igdb.SearchByNameAsync(term, limit, cancellationToken);
            var matchIds = matches.Select(m => m.Id.ToString()).ToList();
            var imported = matchIds.Count == 0
                ? new HashSet<string>()
                : (await _db.GameExternalSources.AsNoTracking()
                    .Where(e => e.Provider == DbExternalProvider.IGDB && matchIds.Contains(e.ExternalId))
                    .Select(e => e.ExternalId)
                    .ToListAsync(cancellationToken))
                  .ToHashSet(StringComparer.Ordinal);

            var hits = new List<ExternalHit>();
            foreach (var match in matches)
            {
                var externalId = match.Id.ToString();
                if (imported.Contains(externalId) || string.IsNullOrWhiteSpace(match.Name) || match.Id <= 0)
                {
                    continue;
                }

                int? year = null;
                if (match.First_release_date is long unix)
                {
                    year = DateTimeOffset.FromUnixTimeSeconds(unix).UtcDateTime.Year;
                }

                var summary = match.Summary;
                if (summary is { Length: > 220 })
                {
                    summary = summary[..220];
                }

                hits.Add(new ExternalHit(
                    externalId,
                    match.Name.Trim(),
                    _images.CoverUrl(match.Cover?.Url),
                    year,
                    summary));

                if (hits.Count >= limit)
                {
                    break;
                }
            }

            return hits;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "IGDB search fallback failed for query {Query}", term);
            return [];
        }
    }

    private static object EmptyResult(string term, int page, int limit, long started) =>
        new
        {
            query = term,
            items = Array.Empty<object>(),
            externalItems = Array.Empty<object>(),
            total = 0,
            page,
            limit,
            totalPages = 0,
            provider = "postgres",
            sources = new[] { "local" },
            tookMs = Environment.TickCount64 - started,
        };

    private static string ToTsQuery(string term)
    {
        var tokens = term.ToLowerInvariant()
            .Replace("'", "", StringComparison.Ordinal)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(t => new string(t.Where(char.IsLetterOrDigit).ToArray()))
            .Where(t => t.Length > 0)
            .Take(8)
            .ToList();

        return tokens.Count == 0 ? "empty:*" : string.Join(" & ", tokens.Select(t => $"{t}:*"));
    }

    private static string EscapeLike(string value) =>
        value.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);

    private sealed record ExternalHit(
        string ExternalId,
        string Name,
        string? CoverImageUrl,
        int? ReleaseYear,
        string? Summary);

    private sealed record SearchRow(Guid Id, double Rank, long Total);

    private sealed record AutocompleteRow(
        Guid Id,
        string Slug,
        string Name,
        string? CoverImageUrl,
        DateOnly? ReleaseDate,
        double? PositivePercentage,
        int? TotalReviews);
}
