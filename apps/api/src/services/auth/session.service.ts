import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { googleConfig } from '../../config/google';
import { SessionWithUser } from './auth.types';
import { UserStatus } from '@prisma/client';

export class SessionService {
  /**
   * Hashes a raw session token using SHA-256 for secure storage.
   */
  public hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generates a cryptographically secure random session token.
   */
  public generateRawToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Creates a new persistent session in PostgreSQL for the specified user.
   * Stores only the hashed token in the database.
   */
  public async createSession(
    userId: string,
    ttlMs: number = googleConfig.SESSION_MAX_AGE_MS
  ): Promise<{ rawToken: string; session: SessionWithUser }> {
    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlMs);

    const session = await prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
      include: {
        user: true,
      },
    });

    return {
      rawToken,
      session: session as SessionWithUser,
    };
  }

  /**
   * Resolves a session by its raw token from the client cookie.
   * Hashes the token, looks up the session in PostgreSQL, verifies expiration,
   * and verifies user active status.
   */
  public async resolveSession(rawToken: string): Promise<SessionWithUser | null> {
    if (!rawToken || typeof rawToken !== 'string') {
      return null;
    }

    const tokenHash = this.hashToken(rawToken);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: true,
      },
    });

    if (!session) {
      return null;
    }

    // Verify expiration
    if (session.expiresAt.getTime() <= Date.now()) {
      // Lazy cleanup of expired session
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    // Verify user is active
    if (session.user.status !== UserStatus.ACTIVE) {
      return null;
    }

    return session as SessionWithUser;
  }

  /**
   * Destroys a session given its raw token.
   */
  public async destroySession(rawToken: string): Promise<boolean> {
    if (!rawToken || typeof rawToken !== 'string') {
      return false;
    }

    const tokenHash = this.hashToken(rawToken);
    const deleteResult = await prisma.session.deleteMany({
      where: { tokenHash },
    });

    return deleteResult.count > 0;
  }

  /**
   * Destroys all active sessions for a user (e.g., password reset, account revocation).
   */
  public async destroyUserSessions(userId: string): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: { userId },
    });
    return result.count;
  }

  /**
   * Purges expired sessions from the database.
   */
  public async cleanupExpiredSessions(): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
      },
    });
    return result.count;
  }
}

export const sessionService = new SessionService();
