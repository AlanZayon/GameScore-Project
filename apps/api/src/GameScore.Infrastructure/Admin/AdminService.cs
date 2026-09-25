using GameScore.Application.Auth;
using GameScore.Application.Configuration;
using GameScore.Application.Errors;
using GameScore.Application.Http;
using GameScore.Domain.Enums;
using GameScore.Infrastructure.Auth;
using GameScore.Infrastructure.Games;
using GameScore.Infrastructure.Integrations;
using GameScore.Infrastructure.Jobs;
using GameScore.Infrastructure.Mappers;
using GameScore.Infrastructure.Persistence;
using GameScore.Infrastructure.Ratings;
using GameScore.Infrastructure.Reviews;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GameScore.Infrastructure.Admin;

public sealed class AdminService
{
    private readonly GameScoreDbContext _db;
    private readonly AuditService _audit;
    private readonly ScoreRecalculationService _scores;
    private readonly ReputationService _reputation;
    private readonly TokenService _tokens;
    private readonly GameImportService _importer;
    private readonly GameSyncService _sync;
    private readonly BackgroundJobScheduler _jobs;
    private readonly ReviewDataAccess _reviews;
    private readonly IgdbClient _igdb;
    private readonly AppConfig _config;

    public AdminService(
        GameScoreDbContext db,
        AuditService audit,
        ScoreRecalculationService scores,
        ReputationService reputation,
        TokenService tokens,
        GameImportService importer,
        GameSyncService sync,
        BackgroundJobScheduler jobs,
        ReviewDataAccess reviews,
        IgdbClient igdb,
        IOptions<AppConfig> config)
    {
        _db = db;
        _audit = audit;
        _scores = scores;
        _reputation = reputation;
        _tokens = tokens;
        _importer = importer;
        _sync = sync;
        _jobs = jobs;
        _reviews = reviews;
        _igdb = igdb;
        _config = config.Value;
    }

    public async Task<object> DashboardAsync(CancellationToken cancellationToken = default)
    {
        var totals = new
        {
            games = await _db.Games.CountAsync(cancellationToken),
            users = await _db.Users.CountAsync(u => u.DeletedAt == null, cancellationToken),
            reviews = await _db.Reviews.CountAsync(r => r.DeletedAt == null, cancellationToken),
            hiddenReviews = await _db.Reviews.CountAsync(r => r.Status == DbReviewStatus.HIDDEN, cancellationToken),
            pendingReports = await _db.ReviewReports.CountAsync(r => r.Status == DbReportStatus.PENDING, cancellationToken),
            openReviewBombEvents = await _db.ReviewBombEvents.CountAsync(
                e => e.Status == DbReviewBombStatus.DETECTED || e.Status == DbReviewBombStatus.CONFIRMED,
                cancellationToken),
            suspendedUsers = await _db.Users.CountAsync(u => u.Status == DbUserStatus.SUSPENDED && u.DeletedAt == null, cancellationToken),
        };

        return new
        {
            totals,
            igdbConfigured = _igdb.IsConfigured,
            recentAuditLogs = await _audit.ListAsync(12, cancellationToken),
        };
    }

    public async Task<object> ListGamesAsync(int? page, int? limit, string? q, CancellationToken cancellationToken = default)
    {
        var safePage = Pagination.ClampPage(page);
        var safeLimit = Pagination.ClampLimit(limit, 50);
        var query = _db.Games.AsNoTracking()
            .Include(g => g.Platforms).ThenInclude(p => p.Platform)
            .Include(g => g.Genres).ThenInclude(g => g.Genre)
            .Include(g => g.Statistics)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(g => EF.Functions.ILike(g.Name, $"%{term}%") || g.Slug.Contains(term));
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(g => g.UpdatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .ToListAsync(cancellationToken);

        return Pagination.Paginated(
            items.Select(g => GameDtoMapper.ToSummary(g, _config.Ranking.ScoreLabelMinimumReviews)).ToList(),
            total,
            safePage,
            safeLimit);
    }

    public async Task<object> ImportGameAsync(string externalId, AuthUser actor, CancellationToken cancellationToken = default)
    {
        var result = await _importer.ImportByExternalIdAsync(externalId, cancellationToken);
        await _audit.RecordAsync(
            actor.Id,
            DbAuditAction.ADMIN_IMPORTED_GAME,
            "game",
            result.GameId.ToString(),
            new { provider = result.Provider, externalId = result.ExternalId, created = result.Created },
            cancellationToken);
        return ToImportDto(result);
    }

    public async Task<object> ImportGameByNameAsync(string name, AuthUser actor, CancellationToken cancellationToken = default)
    {
        var result = await _importer.ImportByNameAsync(name, cancellationToken);
        await _audit.RecordAsync(
            actor.Id,
            DbAuditAction.ADMIN_IMPORTED_GAME,
            "game",
            result.GameId.ToString(),
            new { provider = result.Provider, externalId = result.ExternalId, created = result.Created },
            cancellationToken);
        return ToImportDto(result);
    }

    public async Task<object> SyncGameAsync(Guid gameId, AuthUser actor, CancellationToken cancellationToken = default)
    {
        var result = await _sync.SyncAsync(gameId, cancellationToken);
        await _audit.RecordAsync(actor.Id, DbAuditAction.ADMIN_SYNCED_GAME, "game", gameId.ToString(), cancellationToken: cancellationToken);
        return ToImportDto(result);
    }

    public async Task<object> UpdateGameAsync(
        Guid id,
        AuthUser actor,
        string? name,
        string? summary,
        string? description,
        string? developer,
        string? publisher,
        string? releaseDate,
        string? coverImageUrl,
        string? bannerImageUrl,
        CancellationToken cancellationToken = default)
    {
        var game = await _db.Games
            .Include(g => g.Platforms).ThenInclude(p => p.Platform)
            .Include(g => g.Genres).ThenInclude(g => g.Genre)
            .Include(g => g.Statistics)
            .FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (game is null)
        {
            throw new NotFoundException(ErrorCodes.GameNotFound, "Game not found");
        }

        var edited = game.EditedFields.ToHashSet(StringComparer.Ordinal);
        void Touch(string field, Action apply)
        {
            apply();
            edited.Add(field);
        }

        if (name is not null)
        {
            Touch("name", () => game.Name = name.Trim());
        }

        if (summary is not null)
        {
            Touch("summary", () => game.Summary = string.IsNullOrWhiteSpace(summary) ? null : summary.Trim());
        }

        if (description is not null)
        {
            Touch("description", () => game.Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim());
        }

        if (developer is not null)
        {
            Touch("developer", () => game.Developer = string.IsNullOrWhiteSpace(developer) ? null : developer.Trim());
        }

        if (publisher is not null)
        {
            Touch("publisher", () => game.Publisher = string.IsNullOrWhiteSpace(publisher) ? null : publisher.Trim());
        }

        if (releaseDate is not null)
        {
            Touch("releaseDate", () => game.ReleaseDate = string.IsNullOrWhiteSpace(releaseDate)
                ? null
                : DateOnly.Parse(releaseDate));
        }

        if (coverImageUrl is not null)
        {
            Touch("coverImageUrl", () => game.CoverImageUrl = string.IsNullOrWhiteSpace(coverImageUrl) ? null : coverImageUrl.Trim());
        }

        if (bannerImageUrl is not null)
        {
            Touch("bannerImageUrl", () => game.BannerImageUrl = string.IsNullOrWhiteSpace(bannerImageUrl) ? null : bannerImageUrl.Trim());
        }

        game.EditedFields = edited.ToArray();
        game.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.RecordAsync(actor.Id, DbAuditAction.ADMIN_UPDATED_GAME, "game", id.ToString(), cancellationToken: cancellationToken);
        return GameDtoMapper.ToSummary(game, _config.Ranking.ScoreLabelMinimumReviews);
    }

    public async Task RecalculateGameAsync(Guid gameId, AuthUser actor, CancellationToken cancellationToken = default)
    {
        if (!await _db.Games.AnyAsync(g => g.Id == gameId, cancellationToken))
        {
            throw new NotFoundException(ErrorCodes.GameNotFound, "Game not found");
        }

        await _scores.RecalculateAsync(gameId, cancellationToken: cancellationToken);
        await _audit.RecordAsync(actor.Id, DbAuditAction.ADMIN_RECALCULATED_GAME_SCORE, "game", gameId.ToString(), cancellationToken: cancellationToken);
    }

    public async Task<object> ListReviewsAsync(int? page, int? limit, string? status, CancellationToken cancellationToken = default)
    {
        var safePage = Pagination.ClampPage(page);
        var safeLimit = Pagination.ClampLimit(limit, 50);
        var query = _db.Reviews.AsNoTracking().AsQueryable();
        if (status == "hidden")
        {
            query = query.Where(r => r.Status == DbReviewStatus.HIDDEN);
        }
        else if (status == "deleted")
        {
            query = query.Where(r => r.DeletedAt != null);
        }

        var total = await query.CountAsync(cancellationToken);
        var reviews = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .ToListAsync(cancellationToken);

        var bundles = new List<object>();
        foreach (var review in reviews)
        {
            var bundle = await _reviews.LoadAsync(review.Id, cancellationToken);
            if (bundle is not null)
            {
                bundles.Add(ReviewMapper.ToDto(bundle.Review, bundle.Author, bundle.Game, bundle.Platform, null, null, false));
            }
        }

        return Pagination.Paginated(bundles, total, safePage, safeLimit);
    }

    public async Task RemoveReviewAsync(Guid id, AuthUser actor, string reason, CancellationToken cancellationToken = default)
    {
        var bundle = await _reviews.LoadTrackedAsync(id, cancellationToken);
        if (bundle is null || bundle.Review.DeletedAt is not null)
        {
            throw new NotFoundException(ErrorCodes.ReviewNotFound, "Review not found");
        }

        var review = bundle.Review;
        review.DeletedAt = DateTime.UtcNow;
        review.DeletedById = actor.Id;
        review.DeletionReason = reason;
        review.Status = DbReviewStatus.HIDDEN;
        review.UpdatedAt = DateTime.UtcNow;

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        _reputation.ApplyToUser(bundle.Author, "REVIEW_REMOVED_BY_MODERATOR", "review", review.Id);
        await _scores.RecalculateInsideAsync(review.GameId, true, cancellationToken);
        _audit.RecordOnContext(actor.Id, DbAuditAction.ADMIN_DELETED_REVIEW, "review", id.ToString(), new { reason });
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        _jobs.EnqueueRecalculateGameScore(review.GameId);
        _jobs.EnqueueInvalidateRankings();
        await _reputation.InvalidateUserStatsAsync(review.UserId, cancellationToken);
    }

    public async Task<object> RestoreReviewAsync(Guid id, AuthUser actor, CancellationToken cancellationToken = default)
    {
        var bundle = await _reviews.LoadTrackedAsync(id, cancellationToken);
        if (bundle is null)
        {
            throw new NotFoundException(ErrorCodes.ReviewNotFound, "Review not found");
        }

        if (await _db.Reviews.AnyAsync(
                r => r.UserId == bundle.Review.UserId && r.GameId == bundle.Review.GameId && r.DeletedAt == null && r.Id != id,
                cancellationToken))
        {
            throw new ConflictException(ErrorCodes.ReviewAlreadyExists, "This player already has an active review for that game");
        }

        bundle.Review.DeletedAt = null;
        bundle.Review.DeletedById = null;
        bundle.Review.DeletionReason = null;
        bundle.Review.Status = DbReviewStatus.PUBLISHED;
        bundle.Review.UpdatedAt = DateTime.UtcNow;

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        await _scores.RecalculateInsideAsync(bundle.Review.GameId, true, cancellationToken);
        _audit.RecordOnContext(actor.Id, DbAuditAction.ADMIN_RESTORED_REVIEW, "review", id.ToString());
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        _jobs.EnqueueRecalculateGameScore(bundle.Review.GameId);
        _jobs.EnqueueInvalidateRankings();

        var restored = await _reviews.LoadAsync(id, cancellationToken);
        return ReviewMapper.ToDto(restored!.Review, restored.Author, restored.Game, restored.Platform, null, null, false);
    }

    public async Task<object> UpdateReviewModerationAsync(
        Guid id,
        AuthUser actor,
        DbReviewModerationStatus moderationStatus,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        var bundle = await _reviews.LoadTrackedAsync(id, cancellationToken);
        if (bundle is null)
        {
            throw new NotFoundException(ErrorCodes.ReviewNotFound, "Review not found");
        }

        bundle.Review.ModerationStatus = moderationStatus;
        bundle.Review.ModerationNotes = notes;
        bundle.Review.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.RecordAsync(
            actor.Id,
            DbAuditAction.ADMIN_UPDATED_REVIEW_MODERATION,
            "review",
            id.ToString(),
            new { moderationStatus = moderationStatus.ToString() },
            cancellationToken);

        return ReviewMapper.ToDto(bundle.Review, bundle.Author, bundle.Game, bundle.Platform, null, null, false);
    }

    public async Task<object> ListReportsAsync(int? page, int? limit, string? status, CancellationToken cancellationToken = default)
    {
        var safePage = Pagination.ClampPage(page);
        var safeLimit = Pagination.ClampLimit(limit, 50);
        var query = _db.ReviewReports.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<DbReportStatus>(status, true, out var parsed))
        {
            query = query.Where(r => r.Status == parsed);
        }

        var total = await query.CountAsync(cancellationToken);
        var reports = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .ToListAsync(cancellationToken);

        var items = new List<object>();
        foreach (var report in reports)
        {
            var reporter = await _db.Users.AsNoTracking().FirstAsync(u => u.Id == report.ReporterId, cancellationToken);
            UserEntity? resolvedBy = report.ResolvedById is null
                ? null
                : await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == report.ResolvedById, cancellationToken);
            var bundle = await _reviews.LoadAsync(report.ReviewId, cancellationToken);
            items.Add(new
            {
                id = report.Id,
                reason = report.Reason.ToString(),
                details = report.Details,
                status = report.Status.ToString(),
                createdAt = report.CreatedAt.ToString("O"),
                resolvedAt = report.ResolvedAt?.ToString("O"),
                reporter = Mappers.UserMapper.ToSummary(reporter),
                resolvedBy = resolvedBy is null ? null : Mappers.UserMapper.ToSummary(resolvedBy),
                review = bundle is null
                    ? null
                    : ReviewMapper.ToDto(bundle.Review, bundle.Author, bundle.Game, bundle.Platform, null, null, false),
            });
        }

        return Pagination.Paginated(items, total, safePage, safeLimit);
    }

    public async Task ResolveReportAsync(
        Guid id,
        AuthUser actor,
        DbReportStatus status,
        bool hideReview,
        string? reason,
        CancellationToken cancellationToken = default)
    {
        if (status is not DbReportStatus.RESOLVED and not DbReportStatus.DISMISSED)
        {
            throw new BadRequestException(ErrorCodes.ValidationFailed, "Status must be RESOLVED or DISMISSED");
        }

        var report = await _db.ReviewReports.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (report is null)
        {
            throw new NotFoundException(ErrorCodes.ReportNotFound, "Report not found");
        }

        if (report.Status != DbReportStatus.PENDING)
        {
            throw new ConflictException(ErrorCodes.ReportAlreadyResolved, "Report already resolved");
        }

        Guid? affectedUserId = null;
        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        report.Status = status;
        report.ResolvedAt = DateTime.UtcNow;
        report.ResolvedById = actor.Id;
        report.ResolutionNote = reason;

        if (hideReview && status == DbReportStatus.RESOLVED)
        {
            var bundle = await _reviews.LoadTrackedAsync(report.ReviewId, cancellationToken);
            if (bundle is not null && bundle.Review.DeletedAt is null)
            {
                affectedUserId = bundle.Review.UserId;
                bundle.Review.DeletedAt = DateTime.UtcNow;
                bundle.Review.DeletedById = actor.Id;
                bundle.Review.DeletionReason = reason ?? "Removed after confirmed report";
                bundle.Review.Status = DbReviewStatus.HIDDEN;
                _reputation.ApplyToUser(bundle.Author, "ABUSE_CONFIRMED", "review", bundle.Review.Id);
                await _scores.RecalculateInsideAsync(bundle.Review.GameId, true, cancellationToken);
            }
        }

        _audit.RecordOnContext(
            actor.Id,
            DbAuditAction.ADMIN_RESOLVED_REPORT,
            "report",
            id.ToString(),
            new { status = status.ToString(), hideReview });
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        if (affectedUserId is not null)
        {
            await _reputation.InvalidateUserStatsAsync(affectedUserId.Value, cancellationToken);
        }
    }

    public async Task<object> ListReviewBombsAsync(int? page, int? limit, string? status, CancellationToken cancellationToken = default)
    {
        var safePage = Pagination.ClampPage(page);
        var safeLimit = Pagination.ClampLimit(limit, 50);
        var query = _db.ReviewBombEvents.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<DbReviewBombStatus>(status, true, out var parsed))
        {
            query = query.Where(e => e.Status == parsed);
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(e => e.Status)
            .ThenByDescending(e => e.Severity)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .ToListAsync(cancellationToken);

        var gameIds = items.Select(i => i.GameId).Distinct().ToList();
        var games = await _db.Games.AsNoTracking()
            .Where(g => gameIds.Contains(g.Id))
            .ToDictionaryAsync(g => g.Id, cancellationToken);

        return Pagination.Paginated(
            items.Select(item =>
            {
                games.TryGetValue(item.GameId, out var game);
                return new
                {
                    id = item.Id,
                    game = game is null
                        ? new { id = item.GameId, slug = "", name = "", coverImageUrl = (string?)null }
                        : new
                        {
                            id = game.Id,
                            slug = game.Slug,
                            name = game.Name,
                            coverImageUrl = game.CoverImageUrl,
                        },
                    startAt = item.StartAt.ToString("O"),
                    endAt = item.EndAt.ToString("O"),
                    positiveCount = item.PositiveCount,
                    negativeCount = item.NegativeCount,
                    baselinePerDay = item.BaselinePerDay,
                    severity = item.Severity,
                    status = item.Status.ToString(),
                    detectedAt = item.DetectedAt.ToString("O"),
                    reviewedBy = (object?)null,
                    notes = item.Notes,
                };
            }).ToList(),
            total,
            safePage,
            safeLimit);
    }

    public async Task UpdateReviewBombAsync(
        Guid id,
        AuthUser actor,
        DbReviewBombStatus status,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        var bomb = await _db.ReviewBombEvents.FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
        if (bomb is null)
        {
            throw new NotFoundException(ErrorCodes.ReviewBombEventNotFound, "Review bomb event not found");
        }

        bomb.Status = status;
        bomb.Notes = notes ?? bomb.Notes;
        bomb.ReviewedAt = DateTime.UtcNow;
        bomb.ReviewedById = actor.Id;

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        await _scores.RecalculateInsideAsync(bomb.GameId, true, cancellationToken);
        _audit.RecordOnContext(
            actor.Id,
            DbAuditAction.ADMIN_UPDATED_REVIEW_BOMB_EVENT,
            "review_bomb_event",
            id.ToString(),
            new { status = status.ToString() });
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        _jobs.EnqueueRecalculateGameScore(bomb.GameId);
        _jobs.EnqueueInvalidateRankings();
    }

    public async Task<object> ListUsersAsync(int? page, int? limit, string? q, CancellationToken cancellationToken = default)
    {
        var safePage = Pagination.ClampPage(page);
        var safeLimit = Pagination.ClampLimit(limit, 50);
        var query = _db.Users.AsNoTracking().Where(u => u.DeletedAt == null);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(u => EF.Functions.ILike(u.Username, $"%{term}%") || EF.Functions.ILike(u.Email, $"%{term}%"));
        }

        var total = await query.CountAsync(cancellationToken);
        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .ToListAsync(cancellationToken);

        var items = new List<object>();
        foreach (var user in users)
        {
            var reviewCount = await _db.Reviews.CountAsync(r => r.UserId == user.Id, cancellationToken);
            var reportCount = await _db.ReviewReports.CountAsync(r => r.ReporterId == user.Id, cancellationToken);
            items.Add(new
            {
                id = user.Id,
                username = user.Username,
                displayName = user.DisplayName,
                avatarUrl = user.AvatarUrl,
                reputationScore = user.ReputationScore,
                role = user.Role.ToString(),
                deleted = false,
                email = user.Email,
                status = user.Status.ToString(),
                suspendedUntil = user.SuspendedUntil?.ToString("O"),
                createdAt = user.CreatedAt.ToString("O"),
                reviewCount,
                reportCount,
            });
        }

        return Pagination.Paginated(items, total, safePage, safeLimit);
    }

    public async Task<object> UpdateUserAsync(
        Guid id,
        AuthUser actor,
        DbUserStatus? status,
        DateTime? suspendedUntil,
        string? reason,
        DbUserRole? role,
        CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user is null || user.DeletedAt is not null)
        {
            throw new NotFoundException(ErrorCodes.UserNotFound, "User not found");
        }

        if (status is DbUserStatus.SUSPENDED || (status == DbUserStatus.ACTIVE && user.Status == DbUserStatus.SUSPENDED))
        {
            if (!UserRoles.CanModerateRole(actor.Role, user.Role.ToString()))
            {
                throw new ForbiddenException(ErrorCodes.InsufficientRole, "You cannot suspend or reinstate an account with an equal or higher role");
            }
        }

        if (status == DbUserStatus.SUSPENDED)
        {
            user.Status = DbUserStatus.SUSPENDED;
            user.SuspendedUntil = suspendedUntil;
            user.SuspensionReason = reason ?? "Suspended by moderator";
            await _tokens.RevokeAllForUserAsync(id, cancellationToken);
            await _audit.RecordAsync(actor.Id, DbAuditAction.ADMIN_SUSPENDED_USER, "user", id.ToString(), new { reason }, cancellationToken);
        }
        else if (status == DbUserStatus.ACTIVE && user.Status == DbUserStatus.SUSPENDED)
        {
            user.Status = DbUserStatus.ACTIVE;
            user.SuspendedUntil = null;
            user.SuspensionReason = null;
            await _audit.RecordAsync(actor.Id, DbAuditAction.ADMIN_REINSTATED_USER, "user", id.ToString(), cancellationToken: cancellationToken);
        }

        if (role is not null && actor.Role == UserRoles.Admin)
        {
            user.Role = role.Value;
            await _audit.RecordAsync(actor.Id, DbAuditAction.ADMIN_UPDATED_USER_ROLE, "user", id.ToString(), new { role = role.ToString() }, cancellationToken);
        }

        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var reviewCount = await _db.Reviews.CountAsync(r => r.UserId == user.Id, cancellationToken);
        var reportCount = await _db.ReviewReports.CountAsync(r => r.ReporterId == user.Id, cancellationToken);
        return new
        {
            id = user.Id,
            username = user.Username,
            displayName = user.DisplayName,
            avatarUrl = user.AvatarUrl,
            reputationScore = user.ReputationScore,
            role = user.Role.ToString(),
            deleted = false,
            email = user.Email,
            status = user.Status.ToString(),
            suspendedUntil = user.SuspendedUntil?.ToString("O"),
            createdAt = user.CreatedAt.ToString("O"),
            reviewCount,
            reportCount,
        };
    }

    private static object ToImportDto(ImportResult result) =>
        new
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
