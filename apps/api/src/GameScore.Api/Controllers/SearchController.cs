using GameScore.Api.Authorization;
using GameScore.Infrastructure.Integrations;
using GameScore.Infrastructure.Search;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameScore.Api.Controllers;

[ApiController]
[Route("search")]
public sealed class SearchController(
    PostgresSearchService search,
    GameImportService importer) : ControllerBase
{
    [HttpGet]
    public Task<object> Search(
        [FromQuery(Name = "q")] string q,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        [FromQuery] string? platform = null,
        [FromQuery] string? genre = null,
        CancellationToken cancellationToken = default) =>
        search.SearchAsync(q, page, limit, platform, genre, cancellationToken);

    [HttpGet("autocomplete")]
    public Task<IReadOnlyList<object>> Autocomplete(
        [FromQuery(Name = "q")] string q,
        [FromQuery] int limit = 8,
        CancellationToken cancellationToken = default) =>
        search.AutocompleteAsync(q, limit, cancellationToken);

    [HttpGet("external/{externalId}")]
    public Task<object> External(string externalId, CancellationToken cancellationToken = default) =>
        importer.PreviewExternalAsync(externalId, cancellationToken);

    [HttpPost("import")]
    [Authorize]
    [MinimumRole("ADMIN")]
    public async Task<object> Import([FromBody] ImportExternalRequest body, CancellationToken cancellationToken = default)
    {
        var result = await importer.ImportByExternalIdAsync(body.ExternalId, cancellationToken);
        return new
        {
            gameId = result.GameId,
            slug = result.Slug,
            name = result.Name,
            provider = result.Provider,
            externalId = result.ExternalId,
            created = result.Created,
            warnings = result.Warnings ?? Array.Empty<string>(),
        };
    }
}

public sealed record ImportExternalRequest(string ExternalId);
