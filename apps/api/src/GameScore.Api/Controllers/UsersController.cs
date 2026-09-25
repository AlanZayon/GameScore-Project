using GameScore.Api.Authorization;
using GameScore.Infrastructure.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameScore.Api.Controllers;

[ApiController]
[Route("users")]
public sealed class UsersController(UsersService users, UserStatisticsService statistics) : ControllerBase
{
    [HttpGet("me/export")]
    [Authorize]
    public Task<object> ExportMe(CancellationToken cancellationToken = default)
    {
        var user = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        return users.ExportMeAsync(user.Id, cancellationToken);
    }

    [HttpGet("{username}")]
    public Task<object> Profile(string username, CancellationToken cancellationToken = default) =>
        users.GetProfileAsync(username, cancellationToken);

    [HttpGet("{username}/statistics")]
    public Task<object> Statistics(
        string username,
        [FromQuery] string range = "all",
        CancellationToken cancellationToken = default) =>
        statistics.GetStatisticsAsync(username, range, User.GetAuthUser()?.Role, cancellationToken);

    [HttpGet("{username}/reputation-events")]
    public Task<object> ReputationEvents(
        string username,
        [FromQuery] string? cursor = null,
        [FromQuery] int? limit = null,
        CancellationToken cancellationToken = default) =>
        statistics.ListReputationEventsAsync(username, cursor, limit, User.GetAuthUser()?.Role, cancellationToken);

    [HttpGet("{username}/reviews")]
    public Task<object> ListReviews(
        string username,
        [FromQuery] string? cursor = null,
        [FromQuery] int? limit = null,
        CancellationToken cancellationToken = default) =>
        users.ListReviewsAsync(username, cursor, limit, User.GetAuthUser()?.Id, cancellationToken);

    [HttpPatch("me")]
    [Authorize]
    public Task<object> UpdateMe([FromBody] UpdateMeRequest body, CancellationToken cancellationToken = default)
    {
        var user = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        return users.UpdateMeAsync(user.Id, body.DisplayName, body.Bio, body.AvatarUrl, cancellationToken);
    }

    [HttpDelete("me")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteMe([FromBody] DeleteMeRequest body, CancellationToken cancellationToken = default)
    {
        var user = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        await users.DeleteMeAsync(user.Id, body.Password, cancellationToken);
        return NoContent();
    }
}

public sealed record UpdateMeRequest(string? DisplayName, string? Bio, string? AvatarUrl);
public sealed record DeleteMeRequest(string Password);
