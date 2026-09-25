using System.Text.Json;
using GameScore.Infrastructure.Mappers;
using GameScore.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GameScore.Infrastructure.Admin;

public sealed class AuditService(GameScoreDbContext db)
{
    public async Task RecordAsync(
        Guid actorId,
        DbAuditAction action,
        string targetType,
        string targetId,
        object? metadata = null,
        CancellationToken cancellationToken = default)
    {
        db.AuditLogs.Add(new AuditLogEntity
        {
            Id = Guid.NewGuid(),
            ActorId = actorId,
            Action = action,
            TargetType = targetType,
            TargetId = targetId,
            Metadata = metadata is null ? null : JsonSerializer.Serialize(metadata),
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    public void RecordOnContext(
        Guid actorId,
        DbAuditAction action,
        string targetType,
        string targetId,
        object? metadata = null)
    {
        db.AuditLogs.Add(new AuditLogEntity
        {
            Id = Guid.NewGuid(),
            ActorId = actorId,
            Action = action,
            TargetType = targetType,
            TargetId = targetId,
            Metadata = metadata is null ? null : JsonSerializer.Serialize(metadata),
            CreatedAt = DateTime.UtcNow,
        });
    }

    public async Task<IReadOnlyList<object>> ListAsync(int limit = 30, CancellationToken cancellationToken = default)
    {
        var rows = await db.AuditLogs.AsNoTracking()
            .OrderByDescending(a => a.CreatedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var actorIds = rows.Where(r => r.ActorId is not null).Select(r => r.ActorId!.Value).Distinct().ToList();
        var actors = actorIds.Count == 0
            ? new Dictionary<Guid, UserEntity>()
            : await db.Users.AsNoTracking().Where(u => actorIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, cancellationToken);

        return rows.Select(row => new
        {
            id = row.Id,
            action = row.Action.ToString(),
            actor = row.ActorId is null || !actors.TryGetValue(row.ActorId.Value, out var actor)
                ? null
                : Mappers.UserMapper.ToSummary(actor),
            targetType = row.TargetType,
            targetId = row.TargetId,
            metadata = row.Metadata is null ? null : JsonSerializer.Deserialize<object>(row.Metadata),
            createdAt = row.CreatedAt.ToString("O"),
        }).ToList();
    }
}
