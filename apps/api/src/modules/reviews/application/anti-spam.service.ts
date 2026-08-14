import { Injectable } from '@nestjs/common';
import {
  characterDiversity,
  shoutingRatio,
  wordCount,
  type ReviewModerationStatus,
} from '@gamescore/shared';

import { AppConfigService } from '../../../common/config/app-config.service';
import { BadRequestError, TooManyRequestsError } from '../../../common/errors/app.exception';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { ReviewRepository } from '../repositories/review.repository';

export interface AntiSpamInput {
  userId: string;
  text: string;
  fingerprint: string;
  ipHash: string | null;
}

export interface AntiSpamResult {
  moderationStatus: ReviewModerationStatus;
  rejected: boolean;
}

@Injectable()
export class AntiSpamService {
  constructor(
    private readonly reviews: ReviewRepository,
    private readonly config: AppConfigService,
  ) {}

  async inspect(input: AntiSpamInput): Promise<AntiSpamResult> {
    const { minimumTextLength, maxReviewsPerHour, maxReviewsPerDay, maxAccountsPerIp } =
      this.config.antiSpam;

    if (input.text.trim().length < minimumTextLength) {
      throw new BadRequestError(
        ERROR_CODES.REVIEW_REJECTED_AS_SPAM,
        `Reviews must be at least ${minimumTextLength} characters`,
      );
    }

    if (wordCount(input.text) < 4) {
      throw new BadRequestError(ERROR_CODES.REVIEW_REJECTED_AS_SPAM, 'Review text is too short');
    }

    if (characterDiversity(input.text) < 0.15) {
      throw new BadRequestError(
        ERROR_CODES.REVIEW_REJECTED_AS_SPAM,
        'Review text looks like padding or spam',
      );
    }

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [hourCount, dayCount, duplicateCount, ipAccounts] = await Promise.all([
      this.reviews.countRecentByUser(input.userId, hourAgo),
      this.reviews.countRecentByUser(input.userId, dayAgo),
      this.reviews.countRecentByFingerprint(input.fingerprint, dayAgo, input.userId),
      input.ipHash ? this.reviews.countDistinctUsersByIp(input.ipHash, dayAgo) : Promise.resolve(0),
    ]);

    if (hourCount >= maxReviewsPerHour || dayCount >= maxReviewsPerDay) {
      throw new TooManyRequestsError(
        ERROR_CODES.REVIEW_RATE_LIMIT_EXCEEDED,
        'You are posting reviews too quickly',
      );
    }

    if (duplicateCount >= 2) {
      throw new BadRequestError(
        ERROR_CODES.REVIEW_REJECTED_AS_SPAM,
        'This review text has already been posted recently',
      );
    }

    let moderationStatus: ReviewModerationStatus = 'NORMAL';

    if (shoutingRatio(input.text) > 0.7 || duplicateCount > 0) {
      moderationStatus = 'SUSPICIOUS';
    }

    if (input.ipHash && ipAccounts >= maxAccountsPerIp) {
      moderationStatus = 'MODERATION_REQUIRED';
    }

    return { moderationStatus, rejected: false };
  }
}
