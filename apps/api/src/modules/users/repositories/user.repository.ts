import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService, type PrismaTransaction } from '../../../common/prisma/prisma.service';

/**
 * Columns needed to authenticate someone. Includes the password hash, so this
 * selection must never be used to build a response.
 */
export const credentialsSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  status: true,
  suspendedUntil: true,
  suspensionReason: true,
  reputationScore: true,
  passwordHash: true,
  createdAt: true,
  deletedAt: true,
} satisfies Prisma.UserSelect;

/** Everything that may be shown to other people. */
export const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  reputationScore: true,
  role: true,
} satisfies Prisma.UserSelect;

/** The signed-in user's own account. */
export const accountSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  reputationScore: true,
  role: true,
  status: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export const profileSelect = {
  ...publicUserSelect,
  bio: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/**
 * Minimal set the auth guard needs on every authenticated request: identity,
 * role and whether the account is still allowed to act.
 */
export const authPrincipalSelect = {
  id: true,
  username: true,
  role: true,
  reputationScore: true,
  status: true,
  suspendedUntil: true,
  deletedAt: true,
} satisfies Prisma.UserSelect;

export type UserCredentials = Prisma.UserGetPayload<{ select: typeof credentialsSelect }>;
export type AuthPrincipal = Prisma.UserGetPayload<{ select: typeof authPrincipalSelect }>;
export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
export type AccountUser = Prisma.UserGetPayload<{ select: typeof accountSelect }>;
export type ProfileUser = Prisma.UserGetPayload<{ select: typeof profileSelect }>;

export interface CreateUserData {
  email: string;
  username: string;
  passwordHash: string;
  displayName?: string | null;
  role?: 'USER' | 'MODERATOR' | 'ADMIN';
}

/**
 * All database access for users. Controllers and application services never
 * touch Prisma directly, which keeps queries reviewable in one place.
 */
@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: PrismaTransaction): PrismaTransaction {
    return tx ?? this.prisma;
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: credentialsSelect,
    });
  }

  /** Accepts either an email or a username, which is what the login form asks for. */
  async findCredentialsByIdentifier(identifier: string): Promise<UserCredentials | null> {
    const normalised = identifier.trim().toLowerCase();
    return this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ email: normalised }, { username: normalised }],
      },
      select: credentialsSelect,
    });
  }

  async findCredentialsById(id: string): Promise<UserCredentials | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: credentialsSelect,
    });
  }

  async findAuthPrincipalById(id: string): Promise<AuthPrincipal | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: authPrincipalSelect,
    });
  }

  async findAccountById(id: string): Promise<AccountUser | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: accountSelect,
    });
  }

  async findProfileByUsername(username: string): Promise<ProfileUser | null> {
    return this.prisma.user.findFirst({
      where: { username: username.toLowerCase(), deletedAt: null },
      select: profileSelect,
    });
  }

  async emailExists(email: string): Promise<boolean> {
    const found = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    return found !== null;
  }

  async usernameExists(username: string): Promise<boolean> {
    const found = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    });
    return found !== null;
  }

  async create(data: CreateUserData, tx?: PrismaTransaction): Promise<AccountUser> {
    return this.client(tx).user.create({
      data: {
        email: data.email.toLowerCase(),
        username: data.username.toLowerCase(),
        passwordHash: data.passwordHash,
        displayName: data.displayName ?? null,
        role: data.role ?? 'USER',
      },
      select: accountSelect,
    });
  }

  async clearExpiredSuspension(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE', suspendedUntil: null, suspensionReason: null },
    });
  }
}
