using GameScore.Api.Authorization;
using GameScore.Infrastructure.Reviews;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameScore.Api.Controllers;

[ApiController]
public sealed class ReviewsController(ReviewsService reviews) : ControllerBase
{
    [HttpGet("games/{slug}/reviews")]
    public Task<object> List(
        string slug,
        [FromQuery] string sort = "BEST",
        [FromQuery] string recommendation = "ALL",
        [FromQuery] Guid? platformId = null,
        [FromQuery] int? minHours = null,
        [FromQuery] int? maxHours = null,
        [FromQuery] string? cursor = null,
        [FromQuery] int? limit = null,
        CancellationToken cancellationToken = default) =>
        reviews.ListForGameSlugAsync(
            slug,
            sort,
            recommendation,
            platformId,
            minHours,
            maxHours,
            cursor,
            limit,
            User.GetAuthUser()?.Id,
            cancellationToken);

    [HttpPost("games/{slug}/reviews")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<ActionResult<object>> Create(string slug, [FromBody] CreateReviewRequest body, CancellationToken cancellationToken = default)
    {
        var user = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        var result = await reviews.CreateAsync(
            slug,
            user.Id,
            user.ReputationScore,
            body.Recommended,
            body.Rating,
            body.Text,
            body.HoursPlayed,
            body.PlatformId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            cancellationToken);
        return Created(string.Empty, result);
    }

    [HttpPost("games/external/{externalId}/reviews")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<ActionResult<object>> CreateForExternal(
        string externalId,
        [FromBody] CreateReviewRequest body,
        CancellationToken cancellationToken = default)
    {
        var user = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        var result = await reviews.CreateForExternalAsync(
            externalId,
            user.Id,
            user.ReputationScore,
            body.Recommended,
            body.Rating,
            body.Text,
            body.HoursPlayed,
            body.PlatformId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            cancellationToken);
        return Created(string.Empty, result);
    }

    [HttpGet("reviews/{id:guid}")]
    public Task<object> Get(Guid id, CancellationToken cancellationToken = default) =>
        reviews.GetByIdAsync(id, User.GetAuthUser()?.Id, cancellationToken);

    [HttpPatch("reviews/{id:guid}")]
    [Authorize]
    public Task<object> Update(Guid id, [FromBody] UpdateReviewRequest body, CancellationToken cancellationToken = default)
    {
        var user = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        return reviews.UpdateAsync(
            id,
            user.Id,
            user.ReputationScore,
            body.Recommended,
            body.Rating,
            body.Text,
            body.HoursPlayed,
            body.PlatformId,
            cancellationToken);
    }

    [HttpDelete("reviews/{id:guid}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, [FromBody] DeleteReviewRequest? body, CancellationToken cancellationToken = default)
    {
        var user = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        await reviews.SoftDeleteAsync(id, user.Id, body?.Reason, cancellationToken);
        return NoContent();
    }

    [HttpPost("reviews/{id:guid}/vote")]
    [Authorize]
    public Task<object> Vote(Guid id, [FromBody] VoteReviewRequest body, CancellationToken cancellationToken = default)
    {
        var user = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        return reviews.VoteAsync(id, body.Useful, user.Id, cancellationToken);
    }

    [HttpDelete("reviews/{id:guid}/vote")]
    [Authorize]
    public Task<object> RemoveVote(Guid id, CancellationToken cancellationToken = default)
    {
        var user = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        return reviews.RemoveVoteAsync(id, user.Id, cancellationToken);
    }

    [HttpPost("reviews/{id:guid}/report")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Report(Guid id, [FromBody] ReportReviewRequest body, CancellationToken cancellationToken = default)
    {
        var user = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        await reviews.ReportAsync(id, user.Id, body.Reason, body.Details, cancellationToken);
        return NoContent();
    }
}

public sealed record CreateReviewRequest(bool Recommended, int? Rating, string Text, int? HoursPlayed, Guid? PlatformId);
public sealed record UpdateReviewRequest(bool? Recommended, int? Rating, string? Text, int? HoursPlayed, Guid? PlatformId);
public sealed record DeleteReviewRequest(string? Reason);
public sealed record VoteReviewRequest(bool Useful);
public sealed record ReportReviewRequest(string Reason, string? Details);
