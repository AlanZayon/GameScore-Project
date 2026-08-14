import { Injectable } from '@nestjs/common';
import { applyReputationDelta, type ReputationReason } from '@gamescore/shared';

import type { PrismaTransaction } from '../../../common/prisma/prisma.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class ReputationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Applies a reputation delta and records the event. Always runs inside the
   * caller's transaction so a failed review write cannot leave a dangling
   * reputation change behind.
   */
  async apply(
    userId: string,
    reason: ReputationReason,
    source: { type: string; id: string },
    tx: PrismaTransaction,
  ): Promise<number> {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { reputationScore: true },
    });

    const next = applyReputationDelta(user.reputationScore, reason);
    const delta = next - user.reputationScore;

    await tx.user.update({
      where: { id: userId },
      data: { reputationScore: next },
    });

    await tx.reputationEvent.create({
      data: {
        userId,
        delta,
        reason,
        balanceAfter: next,
        sourceType: source.type,
        sourceId: source.id,
      },
    });

    return next;
  }

  async applyOutsideTransaction(
    userId: string,
    reason: ReputationReason,
    source: { type: string; id: string },
  ): Promise<number> {
    return this.prisma.$transaction((tx) => this.apply(userId, reason, source, tx));
  }
}
