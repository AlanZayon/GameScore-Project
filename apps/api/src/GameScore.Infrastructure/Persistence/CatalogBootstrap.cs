using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GameScore.Infrastructure.Persistence;

/// <summary>
/// Ensures the shared platform/genre catalogue exists. Production never runs the
/// Prisma demo seed, so beta would otherwise have an empty /platforms list and
/// reject every review that picks a platform.
/// </summary>
public static class CatalogBootstrap
{
    private static readonly (string Slug, string Name, string Abbreviation, DbPlatformFamily Family, int SortOrder)[] Platforms =
    [
        ("pc", "PC", "PC", DbPlatformFamily.PC, 1),
        ("ps5", "PlayStation 5", "PS5", DbPlatformFamily.PLAYSTATION, 2),
        ("ps4", "PlayStation 4", "PS4", DbPlatformFamily.PLAYSTATION, 3),
        ("xbox-series", "Xbox Series X|S", "XSX", DbPlatformFamily.XBOX, 4),
        ("xbox-one", "Xbox One", "XB1", DbPlatformFamily.XBOX, 5),
        ("switch", "Nintendo Switch", "NSW", DbPlatformFamily.NINTENDO, 6),
        ("ios", "iOS", "iOS", DbPlatformFamily.MOBILE, 7),
        ("android", "Android", "AND", DbPlatformFamily.MOBILE, 8),
    ];

    private static readonly string[] Genres =
    [
        "Action",
        "Adventure",
        "RPG",
        "Shooter",
        "Strategy",
        "Simulation",
        "Indie",
        "Platformer",
        "Horror",
        "Sports",
    ];

    public static async Task EnsureAsync(
        GameScoreDbContext db,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var addedPlatforms = 0;
        var addedGenres = 0;

        foreach (var platform in Platforms)
        {
            if (await db.Platforms.AnyAsync(p => p.Slug == platform.Slug, cancellationToken))
            {
                continue;
            }

            db.Platforms.Add(new PlatformEntity
            {
                Id = Guid.NewGuid(),
                Slug = platform.Slug,
                Name = platform.Name,
                Abbreviation = platform.Abbreviation,
                Family = platform.Family,
                SortOrder = platform.SortOrder,
                CreatedAt = now,
            });
            addedPlatforms += 1;
        }

        foreach (var name in Genres)
        {
            var slug = Slugify(name);
            if (await db.Genres.AnyAsync(g => g.Slug == slug, cancellationToken))
            {
                continue;
            }

            db.Genres.Add(new GenreEntity
            {
                Id = Guid.NewGuid(),
                Slug = slug,
                Name = name,
                CreatedAt = now,
            });
            addedGenres += 1;
        }

        if (addedPlatforms > 0 || addedGenres > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation(
                "Catalogue bootstrap added {PlatformCount} platforms and {GenreCount} genres",
                addedPlatforms,
                addedGenres);
        }

        await PurgeOrphanImportsAsync(db, logger, cancellationToken);
    }

    /// <summary>
    /// Failed first-review publishes used to leave IGDB games with no reviews and
    /// no platform/genre links. Remove those empty catalogue rows on startup.
    /// </summary>
    public static async Task PurgeOrphanImportsAsync(
        GameScoreDbContext db,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        var orphanIds = await db.Games
            .Where(g => g.ExternalSources.Any(s => s.Provider == DbExternalProvider.IGDB))
            .Where(g => !db.Reviews.Any(r => r.GameId == g.Id && r.DeletedAt == null))
            .Select(g => g.Id)
            .ToListAsync(cancellationToken);

        if (orphanIds.Count == 0)
        {
            return;
        }

        var orphans = await db.Games.Where(g => orphanIds.Contains(g.Id)).ToListAsync(cancellationToken);
        db.Games.RemoveRange(orphans);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Purged {Count} IGDB imports with no reviews", orphans.Count);
    }

    private static string Slugify(string value)
    {
        var chars = value.Trim().ToLowerInvariant().Select(ch =>
            char.IsLetterOrDigit(ch) ? ch : '-').ToArray();
        var slug = new string(chars);
        while (slug.Contains("--", StringComparison.Ordinal))
        {
            slug = slug.Replace("--", "-", StringComparison.Ordinal);
        }

        return slug.Trim('-');
    }
}
