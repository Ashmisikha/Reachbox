import { Request, Response, NextFunction } from 'express';
import { onboardingService } from '../services/onboarding.service';
import { AppError } from '../middleware/errorHandler';

/**
 * GET /api/onboarding/status
 * Retrieves current onboarding and tour state for authenticated user.
 */
export async function getOnboardingStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    }

    const state = await onboardingService.getStatus(userId);
    res.status(200).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/onboarding/setup
 * Updates workspace setup configuration.
 */
export async function saveSetup(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    }

    const { setupCompleted, workspaceName, userName, minDelayMs, hourlyLimit } = req.body;

    const updated = await onboardingService.updateSetup(userId, {
      setupCompleted: setupCompleted !== undefined ? Boolean(setupCompleted) : undefined,
      workspaceName: typeof workspaceName === 'string' ? workspaceName.trim() : undefined,
      userName: typeof userName === 'string' ? userName.trim() : undefined,
      minDelayMs: typeof minDelayMs === 'number' ? Math.max(0, minDelayMs) : undefined,
      hourlyLimit: typeof hourlyLimit === 'number' ? Math.max(1, hourlyLimit) : undefined,
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/onboarding/tour
 * Marks product tour completed or updates tour status.
 */
export async function saveTour(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    }

    const tourCompleted = Boolean(req.body.tourCompleted);
    const updated = await onboardingService.updateTour(userId, tourCompleted);

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/onboarding/tour/replay
 * Resets tour completed flag to enable tour replay.
 */
export async function replayTour(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    }

    const updated = await onboardingService.resetTour(userId);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/onboarding/setup/reset
 * Resets workspace setup to allow re-running the setup wizard.
 */
export async function resetSetup(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
    }

    const updated = await onboardingService.resetSetup(userId);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}
