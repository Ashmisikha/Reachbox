import { redis } from '../lib/redis';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

export interface OnboardingState {
  setupCompleted: boolean;
  tourCompleted: boolean;
  workspaceName: string;
  userName?: string;
  minDelayMs: number;
  hourlyLimit: number;
  updatedAt: string;
}

// In-memory fallback map for environments or test runs where Redis is not connected
const inMemoryStore = new Map<string, OnboardingState>();

export class OnboardingService {
  private getRedisKey(userId: string): string {
    return `onboarding:${userId}`;
  }

  private async ensureRedis(): Promise<boolean> {
    try {
      if (redis.status !== 'ready' && redis.status !== 'connecting') {
        await redis.connect();
      }
      return redis.status === 'ready';
    } catch {
      return false;
    }
  }

  /**
   * Retrieves the onboarding state for a given user.
   * Defaults to uncompleted setup and tour.
   */
  public async getStatus(userId: string): Promise<OnboardingState> {
    const defaultState: OnboardingState = {
      setupCompleted: false,
      tourCompleted: false,
      workspaceName: '',
      minDelayMs: 2000,
      hourlyLimit: 200,
      updatedAt: new Date().toISOString(),
    };

    try {
      const isConnected = await this.ensureRedis();
      if (isConnected) {
        const raw = await redis.get(this.getRedisKey(userId));
        if (raw) {
          return { ...defaultState, ...JSON.parse(raw) };
        }
      }
    } catch (err: any) {
      logger.warn('Failed to read onboarding state from Redis, using fallback', {
        userId,
        error: err.message,
      });
    }

    if (inMemoryStore.has(userId)) {
      return inMemoryStore.get(userId)!;
    }

    return defaultState;
  }

  /**
   * Updates workspace setup details and completion flag.
   */
  public async updateSetup(
    userId: string,
    data: {
      setupCompleted?: boolean;
      workspaceName?: string;
      userName?: string;
      minDelayMs?: number;
      hourlyLimit?: number;
    }
  ): Promise<OnboardingState> {
    const current = await this.getStatus(userId);

    const updated: OnboardingState = {
      ...current,
      setupCompleted: data.setupCompleted !== undefined ? data.setupCompleted : current.setupCompleted,
      workspaceName: data.workspaceName !== undefined ? data.workspaceName : current.workspaceName,
      userName: data.userName !== undefined ? data.userName : current.userName,
      minDelayMs: data.minDelayMs !== undefined ? data.minDelayMs : current.minDelayMs,
      hourlyLimit: data.hourlyLimit !== undefined ? data.hourlyLimit : current.hourlyLimit,
      updatedAt: new Date().toISOString(),
    };

    // If userName is updated, persist to User model in database
    if (data.userName && data.userName.trim().length > 0) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { name: data.userName.trim() },
        });
      } catch (dbErr: any) {
        logger.warn('Could not update user name in DB during setup', {
          userId,
          error: dbErr.message,
        });
      }
    }

    try {
      const isConnected = await this.ensureRedis();
      if (isConnected) {
        await redis.set(this.getRedisKey(userId), JSON.stringify(updated));
      }
    } catch (err: any) {
      logger.warn('Failed to persist onboarding state to Redis', {
        userId,
        error: err.message,
      });
    }

    inMemoryStore.set(userId, updated);
    return updated;
  }

  /**
   * Updates the product tour completion flag.
   */
  public async updateTour(userId: string, tourCompleted: boolean): Promise<OnboardingState> {
    const current = await this.getStatus(userId);

    const updated: OnboardingState = {
      ...current,
      tourCompleted,
      updatedAt: new Date().toISOString(),
    };

    try {
      const isConnected = await this.ensureRedis();
      if (isConnected) {
        await redis.set(this.getRedisKey(userId), JSON.stringify(updated));
      }
    } catch (err: any) {
      logger.warn('Failed to update tour completion in Redis', {
        userId,
        error: err.message,
      });
    }

    inMemoryStore.set(userId, updated);
    return updated;
  }

  /**
   * Resets tour completion so the user can replay it.
   */
  public async resetTour(userId: string): Promise<OnboardingState> {
    return this.updateTour(userId, false);
  }

  /**
   * Resets setup and tour so the user can restart workspace setup.
   */
  public async resetSetup(userId: string): Promise<OnboardingState> {
    return this.updateSetup(userId, { setupCompleted: false });
  }
}

export const onboardingService = new OnboardingService();
