using GameScore.Application.Configuration;
using GameScore.Application.Errors;
using GameScore.Domain.Scoring;
using GameScore.Domain.Utils;
using GameScore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace GameScore.Infrastructure.Integrations;

public sealed class IgdbClient
{
    private const string TokenUrl = "https://id.twitch.tv/oauth2/token";
    private const string ApiUrl = "https://api.igdb.com/v4";
    private readonly AppConfig _config;
    private readonly HttpClient _http;
    private readonly ILogger<IgdbClient> _logger;
    private CachedToken? _token;

    public IgdbClient(IOptions<AppConfig> config, IHttpClientFactory httpClientFactory, ILogger<IgdbClient> logger)
    {
        _config = config.Value;
        _http = httpClientFactory.CreateClient("igdb");
        _logger = logger;
    }

    public bool IsConfigured => _config.Igdb.Configured;

    public async Task<IgdbGame?> GetGameByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        if (!int.TryParse(id, out var numeric))
        {
            throw new BadRequestException(ErrorCodes.IgdbInvalidPayload, "IGDB id must be numeric");
        }

        const string fields =
            "id,name,slug,summary,storyline,first_release_date,updated_at,cover.url,screenshots.url,videos.name,videos.video_id,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,genres.name,platforms.name,platforms.abbreviation,dlcs,expansions";

        var rows = await QueryAsync<IgdbGame>(
            "games",
            $"fields {fields}; where id = {numeric}; limit 1;",
            cancellationToken);
        return rows.FirstOrDefault();
    }

    public Task<IReadOnlyList<IgdbGame>> SearchByNameAsync(string name, int limit = 5, CancellationToken cancellationToken = default)
    {
        var escaped = name.Replace("\"", "", StringComparison.Ordinal);
        var capped = Math.Clamp(limit, 1, 25);
        const string fields =
            "id,name,slug,summary,storyline,first_release_date,updated_at,cover.url,screenshots.url,videos.name,videos.video_id,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,genres.name,platforms.name,platforms.abbreviation,dlcs,expansions";
        return QueryAsync<IgdbGame>(
            "games",
            $"search \"{escaped}\"; fields {fields}; limit {capped};",
            cancellationToken);
    }

    private async Task<IReadOnlyList<T>> QueryAsync<T>(string endpoint, string body, CancellationToken cancellationToken)
    {
        if (!IsConfigured)
        {
            throw new BadRequestException(ErrorCodes.IgdbNotConfigured, "IGDB credentials are not configured");
        }

        var token = await GetAccessTokenAsync(cancellationToken);
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{ApiUrl}/{endpoint}")
        {
            Content = new StringContent(body, Encoding.UTF8, "text/plain"),
        };
        request.Headers.Add("Client-ID", _config.Igdb.ClientId!);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        var response = await _http.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var text = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogWarning("IGDB {Endpoint} failed ({Status}): {Body}", endpoint, response.StatusCode, text[..Math.Min(text.Length, 200)]);
            throw new BadRequestException(ErrorCodes.IgdbRequestFailed, "IGDB request failed");
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        return await JsonSerializer.DeserializeAsync<List<T>>(stream, IgdbJsonOptions, cancellationToken) ?? [];
    }

    private static readonly JsonSerializerOptions IgdbJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private async Task<string> GetAccessTokenAsync(CancellationToken cancellationToken)
    {
        if (_token is not null && _token.ExpiresAt > DateTimeOffset.UtcNow.AddMinutes(1))
        {
            return _token.AccessToken;
        }

        var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = _config.Igdb.ClientId!,
            ["client_secret"] = _config.Igdb.ClientSecret!,
            ["grant_type"] = "client_credentials",
        });

        var response = await _http.PostAsync(TokenUrl, content, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new BadRequestException(ErrorCodes.IgdbRequestFailed, "Could not obtain an IGDB access token");
        }

        var payload = await JsonSerializer.DeserializeAsync<TwitchTokenResponse>(
            await response.Content.ReadAsStreamAsync(cancellationToken),
            cancellationToken: cancellationToken);
        _token = new CachedToken(payload!.AccessToken, DateTimeOffset.UtcNow.AddSeconds(payload.ExpiresIn));
        return _token.AccessToken;
    }

    private sealed record CachedToken(string AccessToken, DateTimeOffset ExpiresAt);

    private sealed record TwitchTokenResponse(
        [property: System.Text.Json.Serialization.JsonPropertyName("access_token")] string AccessToken,
        [property: System.Text.Json.Serialization.JsonPropertyName("expires_in")] int ExpiresIn);
}

public sealed class IgdbGame
{
    public int Id { get; set; }
    public string? Name { get; set; }
    public string? Slug { get; set; }
    public string? Summary { get; set; }
    public string? Storyline { get; set; }
    public long? First_release_date { get; set; }
    public long? Updated_at { get; set; }
    public IgdbCover? Cover { get; set; }
    public List<IgdbCover>? Screenshots { get; set; }
    public List<IgdbVideo>? Videos { get; set; }
    public List<IgdbInvolvedCompany>? Involved_companies { get; set; }
    public List<IgdbNamed>? Genres { get; set; }
    public List<IgdbNamed>? Platforms { get; set; }
    public List<int>? Dlcs { get; set; }
    public List<int>? Expansions { get; set; }
}

public sealed class IgdbCover
{
    public string? Url { get; set; }
}

public sealed class IgdbVideo
{
    public string? Name { get; set; }
    public string? Video_id { get; set; }
}

public sealed class IgdbInvolvedCompany
{
    public bool Developer { get; set; }
    public bool Publisher { get; set; }
    public IgdbNamed? Company { get; set; }
}

public sealed class IgdbNamed
{
    public string? Name { get; set; }
    public string? Abbreviation { get; set; }
}

public sealed class GameImportService
{
    private readonly IgdbClient _igdb;
    private readonly GameScoreDbContext _db;
    private readonly CdnImageProvider _images = new();

    public GameImportService(IgdbClient igdb, GameScoreDbContext db)
    {
        _igdb = igdb;
        _db = db;
    }

    public async Task<ImportResult> ImportByExternalIdAsync(string externalId, CancellationToken cancellationToken = default)
    {
        var existing = await _db.GameExternalSources.AsNoTracking()
            .Include(s => s.Game)
            .FirstOrDefaultAsync(
                s => s.Provider == DbExternalProvider.IGDB && s.ExternalId == externalId,
                cancellationToken);

        if (existing is not null)
        {
            return new ImportResult(
                existing.GameId,
                existing.Game.Slug,
                existing.Game.Name,
                false,
                "IGDB",
                externalId,
                ["Game already imported"]);
        }

        var payload = await _igdb.GetGameByIdAsync(externalId, cancellationToken);
        if (payload is null)
        {
            throw new NotFoundException(ErrorCodes.IgdbGameNotFound, "IGDB game not found");
        }

        return await PersistAsync(payload, externalId, cancellationToken);
    }

    public async Task<ImportResult> ImportByNameAsync(string name, CancellationToken cancellationToken = default)
    {
        var matches = await _igdb.SearchByNameAsync(name, 5, cancellationToken);
        if (matches.Count == 0)
        {
            throw new NotFoundException(ErrorCodes.IgdbGameNotFound, "No IGDB game matched that name");
        }

        return await ImportByExternalIdAsync(matches[0].Id.ToString(), cancellationToken);
    }

    public async Task<object> PreviewExternalAsync(string externalId, CancellationToken cancellationToken = default)
    {
        var existing = await _db.GameExternalSources.AsNoTracking()
            .Include(s => s.Game)
            .FirstOrDefaultAsync(
                s => s.Provider == DbExternalProvider.IGDB && s.ExternalId == externalId,
                cancellationToken);

        if (existing is not null)
        {
            var game = existing.Game;
            return new
            {
                externalId,
                provider = "IGDB",
                name = game.Name,
                summary = game.Summary,
                description = game.Description,
                coverImageUrl = game.CoverImageUrl,
                bannerImageUrl = game.BannerImageUrl,
                trailerYoutubeId = game.TrailerYoutubeId,
                galleryImageUrls = game.GalleryImageUrls,
                releaseDate = game.ReleaseDate?.ToString("yyyy-MM-dd"),
                developer = game.Developer,
                publisher = game.Publisher,
                platforms = Array.Empty<object>(),
                genres = Array.Empty<object>(),
                localSlug = game.Slug,
            };
        }

        var payload = await _igdb.GetGameByIdAsync(externalId, cancellationToken);
        if (payload is null || string.IsNullOrWhiteSpace(payload.Name))
        {
            throw new NotFoundException(ErrorCodes.IgdbGameNotFound, "IGDB game not found");
        }

        var mapped = MapPayload(payload, []);
        return new
        {
            externalId,
            provider = "IGDB",
            name = mapped.Name,
            summary = mapped.Summary,
            description = mapped.Description,
            coverImageUrl = mapped.CoverImageUrl,
            bannerImageUrl = mapped.BannerImageUrl,
            trailerYoutubeId = (string?)null,
            galleryImageUrls = mapped.GalleryImageUrls,
            releaseDate = mapped.ReleaseDate?.ToString("yyyy-MM-dd"),
            developer = mapped.Developer,
            publisher = mapped.Publisher,
            platforms = (payload.Platforms ?? []).Select(p => new { name = p.Name, abbreviation = p.Abbreviation }),
            genres = (payload.Genres ?? []).Select(g => new { name = g.Name }),
            localSlug = (string?)null,
        };
    }

    public MappedGame MapPayload(IgdbGame payload, IList<string> warnings)
    {
        if (string.IsNullOrWhiteSpace(payload.Name))
        {
            throw new BadRequestException(ErrorCodes.IgdbInvalidPayload, "IGDB game is missing a name");
        }

        var developers = payload.Involved_companies?.Where(c => c.Developer).Select(c => c.Company?.Name).Where(n => n is not null);
        var publishers = payload.Involved_companies?.Where(c => c.Publisher).Select(c => c.Company?.Name).Where(n => n is not null);
        var gallery = _images.GalleryUrls(payload.Screenshots?.Select(s => s.Url) ?? []);

        return new MappedGame(
            payload.Name.Trim(),
            payload.Summary?[..Math.Min(payload.Summary?.Length ?? 0, 600)],
            payload.Storyline ?? payload.Summary,
            developers is null ? null : string.Join(", ", developers.Take(3)),
            publishers is null ? null : string.Join(", ", publishers.Take(3)),
            payload.First_release_date is null
                ? null
                : DateOnly.FromDateTime(DateTimeOffset.FromUnixTimeSeconds(payload.First_release_date.Value).UtcDateTime),
            _images.CoverUrl(payload.Cover?.Url),
            _images.BannerUrl(gallery.FirstOrDefault()),
            gallery.ToArray());
    }

    private async Task<ImportResult> PersistAsync(IgdbGame payload, string externalId, CancellationToken cancellationToken)
    {
        var warnings = new List<string>();
        var mapped = MapPayload(payload, warnings);

        var baseSlug = Slug.Slugify(payload.Slug ?? payload.Name);
        var slug = Slug.UniqueSlug(baseSlug, s => _db.Games.Any(g => g.Slug == s));
        var now = DateTime.UtcNow;

        var game = new GameEntity
        {
            Id = Guid.NewGuid(),
            Slug = slug,
            Name = mapped.Name,
            Summary = mapped.Summary,
            Description = mapped.Description,
            Developer = mapped.Developer,
            Publisher = mapped.Publisher,
            ReleaseDate = mapped.ReleaseDate,
            CoverImageUrl = mapped.CoverImageUrl,
            BannerImageUrl = mapped.BannerImageUrl,
            GalleryImageUrls = mapped.GalleryImageUrls,
            CreatedAt = now,
            UpdatedAt = now,
        };

        _db.Games.Add(game);
        _db.GameExternalSources.Add(new GameExternalSourceEntity
        {
            Id = Guid.NewGuid(),
            GameId = game.Id,
            Provider = DbExternalProvider.IGDB,
            ExternalId = externalId,
            ExternalUpdatedAt = payload.Updated_at is null
                ? null
                : DateTimeOffset.FromUnixTimeSeconds(payload.Updated_at.Value).UtcDateTime,
            LastSyncedAt = now,
            RawPayload = JsonSerializer.Serialize(payload),
            CreatedAt = now,
            UpdatedAt = now,
        });

        await _db.SaveChangesAsync(cancellationToken);
        return new ImportResult(game.Id, game.Slug, game.Name, true, "IGDB", externalId, warnings);
    }
}

public sealed record MappedGame(
    string Name,
    string? Summary,
    string? Description,
    string? Developer,
    string? Publisher,
    DateOnly? ReleaseDate,
    string? CoverImageUrl,
    string? BannerImageUrl,
    string[] GalleryImageUrls);

public sealed record ImportResult(
    Guid GameId,
    string Slug,
    string Name,
    bool Created,
    string Provider = "IGDB",
    string? ExternalId = null,
    IReadOnlyList<string>? Warnings = null);
