import { Request, Response, NextFunction } from 'express';
import { slackConfig } from '../config/slack';
import { googleConfig } from '../config/google';
import { slackOAuthService } from '../services/slack/slack-oauth.service';
import { slackConnectionService } from '../services/slack/slack-connection.service';
import { logger } from '../lib/logger';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Initiates the Slack OAuth 2.0 flow for the authenticated user.
 */
export async function connectSlack(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to connect Slack',
        },
      });
      return;
    }

    // Generate single-use state tied to this user ID in Redis
    const state = await slackOAuthService.generateState(userId);

    // Set short-lived HttpOnly cookie for CSRF validation
    res.cookie(slackConfig.SLACK_STATE_COOKIE_NAME, state, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: slackConfig.SLACK_STATE_MAX_AGE_MS,
    });

    const authUrl = slackOAuthService.generateAuthUrl(state);

    logger.info('Slack connect flow initiated', { userId });

    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles the Slack OAuth callback.
 * Validates single-use state against Redis & cookie, exchanges code, and saves connection.
 */
export async function slackCallback(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to complete Slack connection',
        },
      });
      return;
    }

    const { code, state, error: slackError } = req.query;

    if (slackError) {
      logger.warn('Slack OAuth provider returned error', { error: slackError });
      res.status(400).json({
        error: {
          code: 'SLACK_PROVIDER_ERROR',
          message: String(slackError),
        },
      });
      return;
    }

    const cookieState = req.cookies?.[slackConfig.SLACK_STATE_COOKIE_NAME];

    // Clear state cookie
    res.clearCookie(slackConfig.SLACK_STATE_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });

    // 1. Validate state parameter
    await slackOAuthService.validateAndConsumeState(
      String(state || ''),
      String(cookieState || ''),
      userId
    );

    // 2. Code validation
    if (!code || typeof code !== 'string') {
      res.status(400).json({
        error: {
          code: 'INVALID_SLACK_CODE',
          message: 'Authorization code is missing from callback',
        },
      });
      return;
    }

    // 3. Exchange code for installation
    const installation = await slackOAuthService.exchangeCodeForInstallation(code);

    // 4. Persist connection
    await slackConnectionService.saveConnection(userId, installation);

    logger.info('Slack OAuth completed successfully', {
      userId,
      teamName: installation.team?.name,
    });

    // Redirect to frontend app
    res.redirect(`${googleConfig.WEB_ORIGIN}/?slack=connected`);
  } catch (error: any) {
    logger.error('Slack OAuth callback failed', {
      error: error.message,
      code: error.code,
    });

    if (
      error.code === 'INVALID_SLACK_STATE' ||
      error.code === 'EXPIRED_SLACK_STATE' ||
      error.code === 'FORBIDDEN_SLACK_STATE' ||
      error.code === 'INVALID_SLACK_CODE'
    ) {
      res.status(400).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }

    next(error);
  }
}

/**
 * Returns safe Slack connection status for the authenticated user.
 */
export async function getSlackStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    const status = await slackConnectionService.getPublicStatus(userId);
    res.status(200).json(status);
  } catch (error) {
    next(error);
  }
}

/**
 * Disconnects the Slack connection for the authenticated user.
 */
export async function disconnectSlack(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    await slackConnectionService.disconnect(userId);

    res.status(200).json({
      success: true,
      message: 'Slack disconnected successfully',
    });
  } catch (error) {
    next(error);
  }
}
