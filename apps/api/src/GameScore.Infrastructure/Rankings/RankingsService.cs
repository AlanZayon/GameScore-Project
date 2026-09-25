using GameScore.Application.Configuration;
using GameScore.Infrastructure.Cache;
using GameScore.Infrastructure.Games;
using GameScore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GameScore.Infrastructure.Rankings;

public sealed class RankingsService
{
    private const string HomeCacheKey = "home:feed:v2";
    private readonly GameScoreDbContext _db;
    private readonly CacheService _cache;
    private readonly AppConfig _config;

    public RankingsService(GameScoreDbContext db, CacheService cache, IOptions<AppConfig> config)
    {
        _db = db;
        _cache = cache;
        _config = config.Value;
    }

    public Task<object> TopRatedAsync(int limit, CancellationToken cancellationToken = default) =>
        CachedRankingAsync("top-rated", limit, async () =>
        {
            var games = await LoadGamesAsync(
                q => q
                    .Where(g => g.Statistics!.TotalReviews >= _config.Ranking.MinimumReviews)
                    .OrderByDescending(g => g.Statistics!.ConfidenceScore)
                    .ThenByDescending(g => g.Statistics!.TotalReviews),
                limit,
                cancellationToken);

            return BuildRanking("top-rated", "rankings.criteria.topRated", _config.Ranking.MinimumReviews, games);
        }, cancellationToken);

    public Task<object> PopularAsync(int limit, CancellationToken cancellationToken = default) =>
        CachedRankingAsync("popular", limit, async () =>
        {
            var games = await LoadGamesAsync(
                q => q
                    .OrderByDescending(g => g.Statistics!.TotalReviews)
                    .ThenByDescending(g => g.ViewCount),
                limit,
                cancellationToken);

            return BuildRanking("popular", "rankings.criteria.popular", null, games);
        }, cancellationToken);

    public Task<object> NewReleasesAsync(int limit, CancellationToken cancellationToken = default) =>
        CachedRankingAsync("new-releases", limit, async () =>
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var games = await LoadGamesAsync(
                q => q
                    .Where(g => g.ReleaseDate != null && g.ReleaseDate <= today)
                    .OrderByDescending(g => g.ReleaseDate)
                    .ThenByDescending(g => g.CreatedAt),
                limit,
                cancellationToken);

            return BuildRanking("new-releases", "rankings.criteria.newReleases", null, games);
        }, cancellationToken);

    public Task<object> TrendingAsync(int limit, CancellationToken cancellationToken = default) =>
        CachedRankingAsync("trending", limit, async () =>
        {
            var windowStart = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(-_config.Ranking.TrendingWindowDays));
            var activity = await _db.GameActivityDaily.AsNoTracking()
                .Where(a => a.Date >= windowStart)
                .GroupBy(a => a.GameId)
                .Select(g => new { GameId = g.Key, Score = g.Sum(x => x.ReviewCount + x.ViewCount) })
                .OrderByDescending(x => x.Score)
                .Take(limit)
                .ToListAsync(cancellationToken);

            var ids = activity.Select(a => a.GameId).ToList();
            var games = await LoadGamesByIdsAsync(ids, cancellationToken);
            var ordered = ids.Select(id => games.First(g => g.Id == id)).ToList();
            return BuildRanking(
                "trending",
                "rankings.criteria.trending",
                null,
                ordered,
                activity.ToDictionary(a => a.GameId, a => (double)a.Score));
        }, cancellationToken);

    public async Task<object> HomeFeedAsync(CancellationToken cancellationToken = default)
    {
        var cached = await _cache.GetAsync<object>(HomeCacheKey, cancellationToken);
        if (cached is not null)
        {
            return cached;
        }

        const int sectionLimit = 8;

        var popular = await LoadGamesAsync(
            q => q
                .OrderByDescending(g => g.Statistics!.TotalReviews)
                .ThenByDescending(g => g.ViewCount),
            sectionLimit,
            cancellationToken);
        var topRated = await LoadGamesAsync(
            q => q
                .Where(g => g.Statistics!.TotalReviews >= _config.Ranking.MinimumReviews)
                .OrderByDescending(g => g.Statistics!.ConfidenceScore)
                .ThenByDescending(g => g.Statistics!.TotalReviews),
            sectionLimit,
            cancellationToken);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var newReleases = await LoadGamesAsync(
            q => q
                .Where(g => g.ReleaseDate != null && g.ReleaseDate <= today)
                .OrderByDescending(g => g.ReleaseDate)
                .ThenByDescending(g => g.CreatedAt),
            sectionLimit,
            cancellationToken);

        var windowStart = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(-_config.Ranking.TrendingWindowDays));
        var trendingIds = await _db.GameActivityDaily.AsNoTracking()
            .Where(a => a.Date >= windowStart)
            .GroupBy(a => a.GameId)
            .Select(g => new { GameId = g.Key, Score = g.Sum(x => x.ReviewCount + x.ViewCount) })
            .OrderByDescending(x => x.Score)
            .Take(sectionLimit)
            .Select(x => x.GameId)
            .ToListAsync(cancellationToken);

        var trendingGames = await LoadGamesByIdsAsync(trendingIds, cancellationToken);
        var trendingOrdered = trendingIds
            .Select(id => trendingGames.FirstOrDefault(g => g.Id == id))
            .Where(g => g is not null)
            .Cast<GameEntity>()
            .ToList();

        var recentReviews = await _db.Reviews.AsNoTracking()
            .Include(r => r.Game)
            .Include(r => r.User)
            .Where(r => r.DeletedAt == null && r.Status == DbReviewStatus.PUBLISHED)
            .OrderByDescending(r => r.CreatedAt)
            .Take(6)
            .ToListAsync(cancellationToken);

        var gamesCount = await _db.Games.AsNoTracking().CountAsync(cancellationToken);
        var reviewsCount = await _db.Reviews.AsNoTracking()
            .CountAsync(r => r.DeletedAt == null && r.Status == DbReviewStatus.PUBLISHED, cancellationToken);
        var usersCount = await _db.Users.AsNoTracking()
            .CountAsync(u => u.DeletedAt == null, cancellationToken);

        var minLabel = _config.Ranking.ScoreLabelMinimumReviews;
        var feed = new
        {
            popular = popular.Select(g => GameDtoMapper.ToSummary(g, minLabel)),
            topRated = topRated.Select(g => GameDtoMapper.ToSummary(g, minLabel)),
            newReleases = newReleases.Select(g => GameDtoMapper.ToSummary(g, minLabel)),
            trending = trendingOrdered.Select(g => GameDtoMapper.ToSummary(g, minLabel)),
            recentReviews = recentReviews.Select(r => new
            {
                id = r.Id,
                gameSlug = r.Game.Slug,
                gameName = r.Game.Name,
                gameCoverImageUrl = r.Game.CoverImageUrl,
                gameDeveloper = r.Game.Developer,
                authorUsername = r.User.Username,
                authorAvatarUrl = r.User.AvatarUrl,
                recommended = r.Recommended,
                excerpt = r.Text.Length <= 180 ? r.Text : r.Text[..180],
                createdAt = DateTime.SpecifyKind(r.CreatedAt, DateTimeKind.Utc).ToString("O"),
            }),
            totals = new
            {
                games = gamesCount,
                reviews = reviewsCount,
                users = usersCount,
            },
        };

        await _cache.SetAsync(HomeCacheKey, feed, TimeSpan.FromSeconds(45), cancellationToken);
        return feed;
    }

    public async Task InvalidateRankingsAsync(CancellationToken cancellationToken = default)
    {
        await _cache.RemoveByPrefixAsync("rankings:", cancellationToken);
        await _cache.RemoveAsync(HomeCacheKey, cancellationToken);
        await _cache.RemoveAsync("home:feed", cancellationToken);
    }

    private async Task<List<GameEntity>> LoadGamesAsync(
        Func<IQueryable<GameEntity>, IQueryable<GameEntity>> shape,
        int limit,
        CancellationToken cancellationToken)
    {
        var query = _db.Games.AsNoTracking()
            .Include(g => g.Statistics)
            .Include(g => g.Platforms).ThenInclude(gp => gp.Platform)
            .Include(g => g.Genres).ThenInclude(gg => gg.Genre);

        return await shape(query).Take(limit).ToListAsync(cancellationToken);
    }

    private async Task<List<GameEntity>> LoadGamesByIdsAsync(
        IReadOnlyList<Guid> ids,
        CancellationToken cancellationToken)
    {
        if (ids.Count == 0)
        {
            return [];
        }

        return await _db.Games.AsNoTracking()
            .Include(g => g.Statistics)
            .Include(g => g.Platforms).ThenInclude(gp => gp.Platform)
            .Include(g => g.Genres).ThenInclude(gg => gg.Genre)
            .Where(g => ids.Contains(g.Id))
            .ToListAsync(cancellationToken);
    }

    private async Task<object> CachedRankingAsync(
        string key,
        int limit,
        Func<Task<object>> factory,
        CancellationToken cancellationToken)
    {
        var cacheKey = $"rankings:{key}:{limit}";
        var cached = await _cache.GetAsync<object>(cacheKey, cancellationToken);
        if (cached is not null)
        {
            return cached;
        }

        var value = await factory();
        await _cache.SetAsync(cacheKey, value, TimeSpan.FromSeconds(60), cancellationToken);
        return value;
    }

    private object BuildRanking(
        string ranking,
        string criteriaKey,
        int? minimumReviews,
        List<GameEntity> games,
        Dictionary<Guid, double>? rankingValues = null)
    {
        return new
        {
            ranking,
            criteriaKey,
            minimumReviews,
            entries = games.Select((game, index) => new
            {
                position = index + 1,
                game = GameDtoMapper.ToSummary(game, _config.Ranking.ScoreLabelMinimumReviews),
                rankingValue = rankingValues?.GetValueOrDefault(game.Id)
                    ?? game.Statistics?.ConfidenceScore
                    ?? game.Statistics?.TotalReviews
                    ?? 0,
            }),
            generatedAt = DateTime.UtcNow.ToString("O"),
        };
    }
}
