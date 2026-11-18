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
        var existing = await _db.GameExternalSources
            .Include(s => s.Game)
            .FirstOrDefaultAsync(
                s => s.Provider == DbExternalProvider.IGDB && s.ExternalId == externalId,
                cancellationToken);

        if (existing is not null)
        {
            var payload = await _igdb.GetGameByIdAsync(externalId, cancellationToken);
            if (payload is not null)
            {
                await EnsureCatalogueLinksAsync(existing.GameId, payload, cancellationToken);
            }

            return new ImportResult(
                existing.GameId,
                existing.Game.Slug,
                existing.Game.Name,
                false,
                "IGDB",
                externalId,
                ["Game already imported"]);
        }

        var created = await _igdb.GetGameByIdAsync(externalId, cancellationToken);
        if (created is null)
        {
            throw new NotFoundException(ErrorCodes.IgdbGameNotFound, "IGDB game not found");
        }

        return await PersistAsync(created, externalId, cancellationToken);
    }

    /// <summary>
    /// Removes an IGDB-imported game that never received a review (failed first publish).
    /// </summary>
    public async Task<bool> DeleteOrphanImportAsync(Guid gameId, CancellationToken cancellationToken = default)
    {
        var hasReview = await _db.Reviews.AnyAsync(
            r => r.GameId == gameId && r.DeletedAt == null,
            cancellationToken);
        if (hasReview)
        {
            return false;
        }

        var hasIgdb = await _db.GameExternalSources.AnyAsync(
            s => s.GameId == gameId && s.Provider == DbExternalProvider.IGDB,
            cancellationToken);
        if (!hasIgdb)
        {
            return false;
        }

        var game = await _db.Games.FirstOrDefaultAsync(g => g.Id == gameId, cancellationToken);
        if (game is null)
        {
            return false;
        }

        _db.Games.Remove(game);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
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
            var game = await _db.Games.AsNoTracking()
                .Include(g => g.Platforms).ThenInclude(gp => gp.Platform)
                .Include(g => g.Genres).ThenInclude(gg => gg.Genre)
                .FirstAsync(g => g.Id == existing.GameId, cancellationToken);

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
                platforms = game.Platforms.Select(p => new
                {
                    name = p.Platform.Name,
                    abbreviation = p.Platform.Abbreviation,
                }),
                genres = game.Genres.Select(g => new { name = g.Genre.Name }),
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
        _db.GameStatistics.Add(new GameStatisticsEntity
        {
            GameId = game.Id,
            LastCalculatedAt = now,
        });

        await LinkPlatformsAndGenresAsync(game.Id, payload, warnings, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        return new ImportResult(game.Id, game.Slug, game.Name, true, "IGDB", externalId, warnings);
    }

    private async Task EnsureCatalogueLinksAsync(Guid gameId, IgdbGame payload, CancellationToken cancellationToken)
    {
        var hasPlatforms = await _db.GamePlatforms.AnyAsync(gp => gp.GameId == gameId, cancellationToken);
        var hasGenres = await _db.GameGenres.AnyAsync(gg => gg.GameId == gameId, cancellationToken);
        var hasStats = await _db.GameStatistics.AnyAsync(s => s.GameId == gameId, cancellationToken);

        if (hasPlatforms && hasGenres && hasStats)
        {
            return;
        }

        var warnings = new List<string>();
        if (!hasStats)
        {
            _db.GameStatistics.Add(new GameStatisticsEntity
            {
                GameId = gameId,
                LastCalculatedAt = DateTime.UtcNow,
            });
        }

        if (!hasPlatforms || !hasGenres)
        {
            await LinkPlatformsAndGenresAsync(gameId, payload, warnings, cancellationToken);
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task LinkPlatformsAndGenresAsync(
        Guid gameId,
        IgdbGame payload,
        IList<string> warnings,
        CancellationToken cancellationToken)
    {
        var linkedPlatformIds = await _db.GamePlatforms
            .Where(gp => gp.GameId == gameId)
            .Select(gp => gp.PlatformId)
            .ToListAsync(cancellationToken);
        var linkedGenreIds = await _db.GameGenres
            .Where(gg => gg.GameId == gameId)
            .Select(gg => gg.GenreId)
            .ToListAsync(cancellationToken);

        foreach (var igdbPlatform in payload.Platforms ?? [])
        {
            if (string.IsNullOrWhiteSpace(igdbPlatform.Name) && string.IsNullOrWhiteSpace(igdbPlatform.Abbreviation))
            {
                continue;
            }

            var platform = await ResolveOrCreatePlatformAsync(igdbPlatform, cancellationToken);
            if (linkedPlatformIds.Contains(platform.Id))
            {
                continue;
            }

            _db.GamePlatforms.Add(new GamePlatformEntity
            {
                GameId = gameId,
                PlatformId = platform.Id,
            });
            linkedPlatformIds.Add(platform.Id);
        }

        foreach (var igdbGenre in payload.Genres ?? [])
        {
            if (string.IsNullOrWhiteSpace(igdbGenre.Name))
            {
                continue;
            }

            var genre = await ResolveOrCreateGenreAsync(igdbGenre.Name, cancellationToken);
            if (linkedGenreIds.Contains(genre.Id))
            {
                continue;
            }

            _db.GameGenres.Add(new GameGenreEntity
            {
                GameId = gameId,
                GenreId = genre.Id,
            });
            linkedGenreIds.Add(genre.Id);
        }

        if ((payload.Platforms?.Count ?? 0) > 0 && linkedPlatformIds.Count == 0)
        {
            warnings.Add("No platforms could be linked from IGDB");
        }
    }

    private async Task<PlatformEntity> ResolveOrCreatePlatformAsync(
        IgdbNamed igdbPlatform,
        CancellationToken cancellationToken)
    {
        var name = (igdbPlatform.Name ?? "").Trim();
        var abbreviation = (igdbPlatform.Abbreviation ?? "").Trim();
        var slugSource = !string.IsNullOrWhiteSpace(abbreviation) ? abbreviation : name;
        var slug = Slug.Slugify(slugSource);

        var platforms = await _db.Platforms.ToListAsync(cancellationToken);
        var match = platforms.FirstOrDefault(p =>
            (!string.IsNullOrEmpty(slug) && p.Slug == slug)
            || (!string.IsNullOrEmpty(abbreviation)
                && p.Abbreviation.Equals(abbreviation, StringComparison.OrdinalIgnoreCase))
            || (!string.IsNullOrEmpty(name) && p.Name.Equals(name, StringComparison.OrdinalIgnoreCase))
            || (!string.IsNullOrEmpty(name)
                && name.Contains(p.Name, StringComparison.OrdinalIgnoreCase)
                && p.Name.Length >= 2)
            || (!string.IsNullOrEmpty(abbreviation)
                && p.Name.Contains(abbreviation, StringComparison.OrdinalIgnoreCase)));

        if (match is not null)
        {
            return match;
        }

        if (string.IsNullOrEmpty(slug))
        {
            slug = Slug.Slugify(name);
        }

        if (string.IsNullOrEmpty(slug))
        {
            slug = "platform";
        }

        slug = Slug.UniqueSlug(slug, s => platforms.Any(p => p.Slug == s));
        var created = new PlatformEntity
        {
            Id = Guid.NewGuid(),
            Slug = slug,
            Name = string.IsNullOrWhiteSpace(name) ? abbreviation : name,
            Abbreviation = string.IsNullOrWhiteSpace(abbreviation)
                ? (name.Length <= 6 ? name.ToUpperInvariant() : slug.ToUpperInvariant())
                : abbreviation,
            Family = InferFamily(name, abbreviation),
            SortOrder = 100 + platforms.Count,
            CreatedAt = DateTime.UtcNow,
        };
        _db.Platforms.Add(created);
        platforms.Add(created);
        return created;
    }

    private async Task<GenreEntity> ResolveOrCreateGenreAsync(string name, CancellationToken cancellationToken)
    {
        var trimmed = name.Trim();
        var slug = Slug.Slugify(trimmed);
        var existing = await _db.Genres.FirstOrDefaultAsync(
            g => g.Slug == slug || g.Name.ToLower() == trimmed.ToLower(),
            cancellationToken);
        if (existing is not null)
        {
            return existing;
        }

        var created = new GenreEntity
        {
            Id = Guid.NewGuid(),
            Slug = Slug.UniqueSlug(slug, s => _db.Genres.Any(g => g.Slug == s)),
            Name = trimmed,
            CreatedAt = DateTime.UtcNow,
        };
        _db.Genres.Add(created);
        return created;
    }

    private static DbPlatformFamily InferFamily(string name, string abbreviation)
    {
        var haystack = $"{name} {abbreviation}".ToLowerInvariant();
        if (haystack.Contains("playstation", StringComparison.Ordinal)
            || haystack.Contains("ps vita", StringComparison.Ordinal)
            || System.Text.RegularExpressions.Regex.IsMatch(haystack, @"\bps[1-5]\b")
            || haystack.Contains("psp", StringComparison.Ordinal))
        {
            return DbPlatformFamily.PLAYSTATION;
        }

        if (haystack.Contains("xbox", StringComparison.Ordinal))
        {
            return DbPlatformFamily.XBOX;
        }

        if (haystack.Contains("nintendo", StringComparison.Ordinal)
            || haystack.Contains("switch", StringComparison.Ordinal)
            || haystack.Contains("wii", StringComparison.Ordinal)
            || haystack.Contains("gamecube", StringComparison.Ordinal)
            || haystack.Contains("game boy", StringComparison.Ordinal)
            || haystack.Contains("n64", StringComparison.Ordinal)
            || haystack.Contains("3ds", StringComparison.Ordinal)
            || System.Text.RegularExpressions.Regex.IsMatch(haystack, @"\bds\b"))
        {
            return DbPlatformFamily.NINTENDO;
        }

        if (haystack.Contains("ios", StringComparison.Ordinal)
            || haystack.Contains("android", StringComparison.Ordinal)
            || haystack.Contains("mobile", StringComparison.Ordinal))
        {
            return DbPlatformFamily.MOBILE;
        }

        if (haystack.Contains("windows", StringComparison.Ordinal)
            || haystack.Contains("linux", StringComparison.Ordinal)
            || haystack.Contains("mac", StringComparison.Ordinal)
            || System.Text.RegularExpressions.Regex.IsMatch(haystack, @"\bpc\b"))
        {
            return DbPlatformFamily.PC;
        }

        return DbPlatformFamily.OTHER;
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
