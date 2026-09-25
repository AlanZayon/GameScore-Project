using GameScore.Api.Authorization;
using GameScore.Infrastructure.Admin;
using GameScore.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GameScore.Api.Controllers;

[ApiController]
[Route("admin")]
[Authorize]
[MinimumRole("MODERATOR")]
public sealed class AdminController(AdminService admin) : ControllerBase
{
    [HttpGet("dashboard")]
    public Task<object> Dashboard(CancellationToken cancellationToken = default) =>
        admin.DashboardAsync(cancellationToken);

    [HttpGet("games")]
    [MinimumRole("ADMIN")]
    public Task<object> Games(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50,
        [FromQuery] string? q = null,
        CancellationToken cancellationToken = default) =>
        admin.ListGamesAsync(page, limit, q, cancellationToken);

    [HttpPatch("games/{id:guid}")]
    [MinimumRole("ADMIN")]
    public Task<object> UpdateGame(
        Guid id,
        [FromBody] UpdateGameRequest body,
        CancellationToken cancellationToken = default)
    {
        var actor = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        return admin.UpdateGameAsync(
            id,
            actor,
            body.Name,
            body.Summary,
            body.Description,
            body.Developer,
            body.Publisher,
            body.ReleaseDate,
            body.CoverImageUrl,
            body.BannerImageUrl,
            cancellationToken);
    }

    [HttpPost("games/import")]
    [MinimumRole("ADMIN")]
    public Task<object> ImportGame([FromBody] ImportGameRequest body, CancellationToken cancellationToken = default)
    {
        var actor = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        return admin.ImportGameAsync(body.ExternalId, actor, cancellationToken);
    }

    [HttpPost("games/import/search")]
    [MinimumRole("ADMIN")]
    public Task<object> ImportByName([FromBody] ImportGameByNameRequest body, CancellationToken cancellationToken = default)
    {
        var actor = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        return admin.ImportGameByNameAsync(body.Name, actor, cancellationToken);
    }

    [HttpPost("games/{id:guid}/sync")]
    [MinimumRole("ADMIN")]
    public Task<object> SyncGame(Guid id, CancellationToken cancellationToken = default)
    {
        var actor = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        return admin.SyncGameAsync(id, actor, cancellationToken);
    }

    [HttpPost("games/{id:guid}/recalculate")]
    [MinimumRole("ADMIN")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Recalculate(Guid id, CancellationToken cancellationToken = default)
    {
        var actor = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        await admin.RecalculateGameAsync(id, actor, cancellationToken);
        return NoContent();
    }

    [HttpGet("reviews")]
    public Task<object> Reviews(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default) =>
        admin.ListReviewsAsync(page, limit, status, cancellationToken);

    [HttpPost("reviews/{id:guid}/remove")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RemoveReview(
        Guid id,
        [FromBody] ModerateReviewRequest body,
        CancellationToken cancellationToken = default)
    {
        var actor = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        await admin.RemoveReviewAsync(id, actor, body.Reason ?? "Removed by moderator", cancellationToken);
        return NoContent();
    }

    [HttpPost("reviews/{id:guid}/restore")]
    public Task<object> RestoreReview(Guid id, CancellationToken cancellationToken = default)
    {
        var actor = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        return admin.RestoreReviewAsync(id, actor, cancellationToken);
    }

    [HttpPatch("reviews/{id:guid}/moderation")]
    public Task<object> UpdateModeration(
        Guid id,
        [FromBody] ModerateReviewRequest body,
        CancellationToken cancellationToken = default)
    {
        var actor = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        var status = body.ModerationStatus is null
            ? DbReviewModerationStatus.MODERATION_REQUIRED
            : Enum.Parse<DbReviewModerationStatus>(body.ModerationStatus, true);
        return admin.UpdateReviewModerationAsync(id, actor, status, body.Reason, cancellationToken);
    }

    [HttpGet("reports")]
    public Task<object> Reports(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default) =>
        admin.ListReportsAsync(page, limit, status, cancellationToken);

    [HttpPost("reports/{id:guid}/resolve")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ResolveReport(
        Guid id,
        [FromBody] ResolveReportRequest body,
        CancellationToken cancellationToken = default)
    {
        var actor = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        var status = Enum.Parse<DbReportStatus>(body.Status, true);
        await admin.ResolveReportAsync(id, actor, status, body.HideReview ?? false, body.Reason, cancellationToken);
        return NoContent();
    }

    [HttpGet("review-bombs")]
    public Task<object> ReviewBombs(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default) =>
        admin.ListReviewBombsAsync(page, limit, status, cancellationToken);

    [HttpPatch("review-bombs/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> UpdateBomb(
        Guid id,
        [FromBody] UpdateReviewBombRequest body,
        CancellationToken cancellationToken = default)
    {
        var actor = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        var status = Enum.Parse<DbReviewBombStatus>(body.Status, true);
        await admin.UpdateReviewBombAsync(id, actor, status, body.Notes, cancellationToken);
        return NoContent();
    }

    [HttpGet("users")]
    public Task<object> Users(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50,
        [FromQuery] string? q = null,
        CancellationToken cancellationToken = default) =>
        admin.ListUsersAsync(page, limit, q, cancellationToken);

    [HttpPatch("users/{id:guid}")]
    public Task<object> UpdateUser(
        Guid id,
        [FromBody] UpdateUserRequest body,
        CancellationToken cancellationToken = default)
    {
        var actor = User.GetAuthUser() ?? throw new Application.Errors.UnauthorizedException();
        DbUserStatus? status = body.Status is null ? null : Enum.Parse<DbUserStatus>(body.Status, true);
        DbUserRole? role = body.Role is null ? null : Enum.Parse<DbUserRole>(body.Role, true);
        DateTime? suspendedUntil = body.SuspendedUntil is null ? null : DateTime.Parse(body.SuspendedUntil);
        return admin.UpdateUserAsync(id, actor, status, suspendedUntil, body.Reason, role, cancellationToken);
    }
}

public sealed record ImportGameRequest(string ExternalId);
public sealed record ImportGameByNameRequest(string Name);
public sealed record UpdateGameRequest(
    string? Name,
    string? Summary,
    string? Description,
    string? Developer,
    string? Publisher,
    string? ReleaseDate,
    string? CoverImageUrl,
    string? BannerImageUrl);
public sealed record ModerateReviewRequest(string? Reason, string? ModerationStatus);
public sealed record ResolveReportRequest(string Status, bool? HideReview, string? Reason);
public sealed record UpdateReviewBombRequest(string Status, string? Notes);
public sealed record UpdateUserRequest(string? Status, string? Role, string? SuspendedUntil, string? Reason);
