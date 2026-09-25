using GameScore.Infrastructure.Rankings;
using Microsoft.AspNetCore.Mvc;

namespace GameScore.Api.Controllers;

[ApiController]
public sealed class RankingsController(RankingsService rankings) : ControllerBase
{
    [HttpGet("home")]
    public Task<object> Home(CancellationToken cancellationToken = default) =>
        rankings.HomeFeedAsync(cancellationToken);

    [HttpGet("rankings/top-rated")]
    public Task<object> TopRated([FromQuery] int limit = 25, CancellationToken cancellationToken = default) =>
        rankings.TopRatedAsync(limit, cancellationToken);

    [HttpGet("rankings/trending")]
    public Task<object> Trending([FromQuery] int limit = 25, CancellationToken cancellationToken = default) =>
        rankings.TrendingAsync(limit, cancellationToken);

    [HttpGet("rankings/new-releases")]
    public Task<object> NewReleases([FromQuery] int limit = 25, CancellationToken cancellationToken = default) =>
        rankings.NewReleasesAsync(limit, cancellationToken);

    [HttpGet("rankings/popular")]
    public Task<object> Popular([FromQuery] int limit = 25, CancellationToken cancellationToken = default) =>
        rankings.PopularAsync(limit, cancellationToken);
}
