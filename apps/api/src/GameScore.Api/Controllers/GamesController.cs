using GameScore.Api.Authorization;
using GameScore.Infrastructure.Games;
using Microsoft.AspNetCore.Mvc;

namespace GameScore.Api.Controllers;

[ApiController]
public sealed class GamesController(GamesService games) : ControllerBase
{
    [HttpGet("games")]
    public Task<object> List(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 24,
        [FromQuery] string? platform = null,
        [FromQuery] string? genre = null,
        [FromQuery] string sort = "POPULAR",
        CancellationToken cancellationToken = default) =>
        games.ListAsync(page, limit, platform, genre, sort, cancellationToken);

    [HttpGet("games/{slug}")]
    public Task<object> GetBySlug(string slug, CancellationToken cancellationToken = default)
    {
        var viewer = User.GetAuthUser()?.Id;
        return games.GetBySlugAsync(slug, viewer, cancellationToken);
    }

    [HttpGet("games/{slug}/statistics")]
    public Task<object> Statistics(string slug, CancellationToken cancellationToken = default) =>
        games.GetStatisticsBySlugAsync(slug, cancellationToken);

    [HttpGet("platforms")]
    public Task<IReadOnlyList<object>> Platforms(CancellationToken cancellationToken = default) =>
        games.ListPlatformsAsync(cancellationToken);

    [HttpGet("genres")]
    public Task<IReadOnlyList<object>> Genres(CancellationToken cancellationToken = default) =>
        games.ListGenresAsync(cancellationToken);
}
