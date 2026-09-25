using GameScore.Application.Errors;
using GameScore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace GameScore.Infrastructure.Integrations;

public sealed class GameSyncService
{
    private readonly IgdbClient _igdb;
    private readonly GameImportService _importer;
    private readonly GameScoreDbContext _db;

    public GameSyncService(IgdbClient igdb, GameImportService importer, GameScoreDbContext db)
    {
        _igdb = igdb;
        _importer = importer;
        _db = db;
    }

    public async Task<ImportResult> SyncAsync(Guid gameId, CancellationToken cancellationToken = default)
    {
        var game = await _db.Games.FirstOrDefaultAsync(g => g.Id == gameId, cancellationToken);
        if (game is null)
        {
            throw new NotFoundException(ErrorCodes.GameNotFound, "Game not found");
        }

        var source = await _db.GameExternalSources.FirstOrDefaultAsync(
            s => s.GameId == gameId && s.Provider == DbExternalProvider.IGDB,
            cancellationToken);
        if (source is null)
        {
            throw new NotFoundException(ErrorCodes.IgdbGameNotFound, "This game has no IGDB source");
        }

        var payload = await _igdb.GetGameByIdAsync(source.ExternalId, cancellationToken);
        if (payload is null)
        {
            throw new NotFoundException(ErrorCodes.IgdbGameNotFound, "IGDB game not found");
        }

        var warnings = new List<string>();
        var mapped = _importer.MapPayload(payload, warnings);
        var edited = game.EditedFields.ToHashSet(StringComparer.Ordinal);

        if (!edited.Contains("name"))
        {
            game.Name = mapped.Name;
        }

        if (!edited.Contains("summary"))
        {
            game.Summary = mapped.Summary;
        }

        if (!edited.Contains("description"))
        {
            game.Description = mapped.Description;
        }

        if (!edited.Contains("developer"))
        {
            game.Developer = mapped.Developer;
        }

        if (!edited.Contains("publisher"))
        {
            game.Publisher = mapped.Publisher;
        }

        if (!edited.Contains("releaseDate"))
        {
            game.ReleaseDate = mapped.ReleaseDate;
        }

        if (!edited.Contains("coverImageUrl"))
        {
            game.CoverImageUrl = mapped.CoverImageUrl;
        }

        if (!edited.Contains("bannerImageUrl"))
        {
            game.BannerImageUrl = mapped.BannerImageUrl;
        }

        if (!edited.Contains("galleryImageUrls"))
        {
            game.GalleryImageUrls = mapped.GalleryImageUrls;
        }

        game.UpdatedAt = DateTime.UtcNow;
        source.LastSyncedAt = DateTime.UtcNow;
        source.ExternalUpdatedAt = payload.Updated_at is null
            ? source.ExternalUpdatedAt
            : DateTimeOffset.FromUnixTimeSeconds(payload.Updated_at.Value).UtcDateTime;
        source.RawPayload = JsonSerializer.Serialize(payload);
        source.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        return new ImportResult(
            gameId,
            game.Slug,
            game.Name,
            Created: false,
            Provider: "IGDB",
            ExternalId: source.ExternalId,
            warnings);
    }
}
