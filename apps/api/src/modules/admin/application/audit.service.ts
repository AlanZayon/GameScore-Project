import { Injectable } from '@nestjs/common';
import type { AuditAction } from '@gamescore/shared';
import type { AuditLogDto } from '@gamescore/types';

import { PrismaService, type PrismaTransaction } from '../../../common/prisma/prisma.service';
import { toUserSummary } from '../../users/mappers/user.mapper';
import { publicUserSelect } from '../../users/repositories/user.repository';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    actorId: string,
    action: AuditAction,
    target: { type: string; id: string },
    metadata?: Record<string, unknown>,
    tx?: PrismaTransaction,
  ): Promise<void> {
    const db = tx ?? this.prisma;
    await db.auditLog.create({
      data: {
        actorId,
        action,
        targetType: target.type,
        targetId: target.id,
        metadata: metadata ? (JSON.parse(JSON.stringify(metadata)) as object) : undefined,
      },
    });
  }

  async list(limit = 30): Promise<AuditLogDto[]> {
    const rows = await this.prisma.auditLog.findMany({
      include: { actor: { select: publicUserSelect } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      actor: row.actor ? toUserSummary(row.actor) : null,
      targetType: row.targetType,
      targetId: row.targetId,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
