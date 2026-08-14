import type { AuthenticatedUser, UserProfile, UserProfileStats, UserSummary } from '@gamescore/types';

import type { AccountUser, ProfileUser, PublicUser } from '../repositories/user.repository';

/**
 * Mappers are the boundary between database rows and the HTTP contract. Going
 * through them is what guarantees a password hash or an email address cannot
 * leak into a public response by accident.
 */
export function toUserSummary(user: PublicUser): UserSummary {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    reputationScore: user.reputationScore,
    role: user.role,
  };
}

export function toAuthenticatedUser(user: AccountUser): AuthenticatedUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    reputationScore: user.reputationScore,
    role: user.role,
    email: user.email,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toUserProfile(user: ProfileUser, stats: UserProfileStats): UserProfile {
  return {
    ...toUserSummary(user),
    bio: user.bio,
    createdAt: user.createdAt.toISOString(),
    stats,
  };
}
