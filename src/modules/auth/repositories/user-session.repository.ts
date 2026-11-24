import { Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { DrizzleService } from '../../../database/drizzle.service';
import { users } from '../../../database/schema';

const sessionUserColumns = {
  id: users.id,
  email: users.email,
  username: users.username,
  fullName: users.fullName,
  avatarUrl: users.avatarUrl,
  isEmailVerified: users.isEmailVerified,
  createdAt: users.createdAt,
  passwordHash: users.passwordHash,
  tokenVersion: users.tokenVersion,
  refreshTokenHash: users.refreshTokenHash,
};

export type SessionUserRecord = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  createdAt: Date;
  passwordHash: string;
  tokenVersion: number;
  refreshTokenHash: string | null;
};

/** Database access for login / refresh / logout. Soft-deleted users are ignored. */
@Injectable()
export class UserSessionRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findByEmail(email: string): Promise<SessionUserRecord | undefined> {
    const [user] = await this.drizzle.db
      .select(sessionUserColumns)
      .from(users)
      .where(
        and(
          sql`lower(${users.email}) = ${email.trim().toLowerCase()}`,
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    return user;
  }

  async findById(id: string): Promise<SessionUserRecord | undefined> {
    const [user] = await this.drizzle.db
      .select(sessionUserColumns)
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return user;
  }

  async setRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    await this.drizzle.db
      .update(users)
      .set({ refreshTokenHash: hash, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async replacePassword(
    expected: Pick<SessionUserRecord, 'id' | 'passwordHash' | 'tokenVersion'>,
    passwordHash: string,
  ): Promise<boolean> {
    const updated = await this.drizzle.db
      .update(users)
      .set({
        passwordHash,
        tokenVersion: sql`${users.tokenVersion} + 1`,
        refreshTokenHash: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(users.id, expected.id),
          eq(users.passwordHash, expected.passwordHash),
          eq(users.tokenVersion, expected.tokenVersion),
          isNull(users.deletedAt),
        ),
      )
      .returning({ id: users.id });
    return updated.length > 0;
  }

  /**
   * Replaces the stored hash only if it is still `expectedHash`, so two requests
   * using the same refresh token cannot both rotate it. Returns false if it lost.
   */
  async rotateRefreshTokenHash(
    id: string,
    expectedHash: string,
    nextHash: string,
  ): Promise<boolean> {
    const updated = await this.drizzle.db
      .update(users)
      .set({ refreshTokenHash: nextHash, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.refreshTokenHash, expectedHash)))
      .returning({ id: users.id });
    return updated.length > 0;
  }
}
