import { Request, Response, NextFunction } from 'express';
import { googleConfig } from '../config/google';
import { googleOAuthService } from '../services/auth/google-oauth.service';
import { authService } from '../services/auth/auth.service';
import { sessionService } from '../services/auth/session.service';
import { logger } from '../lib/logger';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Initiates the Google OAuth 2.0 flow.
 * Generates a secure CSRF state token, stores it in an HttpOnly cookie,
 * and redirects the user agent to Google's authorization endpoint.
 */
export async function startGoogleAuth(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const state = googleOAuthService.generateState();

    // Store state in a secure, short-lived HttpOnly cookie for CSRF validation
    res.cookie(googleConfig.OAUTH_STATE_COOKIE_NAME, state, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: googleConfig.OAUTH_STATE_MAX_AGE_MS,
    });

    const authUrl = googleOAuthService.generateAuthUrl(state);

    logger.info('Google login started', {
      redirectUri: googleConfig.GOOGLE_REDIRECT_URI,
    });

    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles the Google OAuth callback.
 * Validates CSRF state, exchanges authorization code, verifies identity,
 * resolves/creates the User, establishes a persistent session, and sets the session cookie.
 */
export async function googleCallback(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { code, state, error: oauthError, error_description } = req.query;

    // Check if Google returned an error
    if (oauthError) {
      logger.warn('Google OAuth provider returned error', {
        error: oauthError,
        description: error_description,
      });
      res.status(400).json({
        error: {
          code: 'OAUTH_PROVIDER_ERROR',
          message: String(error_description || oauthError),
        },
      });
      return;
    }

    const expectedState = req.cookies?.[googleConfig.OAUTH_STATE_COOKIE_NAME];

    // Clear state cookie regardless of outcome
    res.clearCookie(googleConfig.OAUTH_STATE_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });

    // 1. CSRF State Validation
    if (!state || typeof state !== 'string' || !expectedState || state !== expectedState) {
      logger.warn('Failed OAuth callback: invalid or missing state parameter', {
        hasQueryState: Boolean(state),
        hasExpectedState: Boolean(expectedState),
      });
      res.status(400).json({
        error: {
          code: 'INVALID_OAUTH_STATE',
          message: 'OAuth State mismatch or expired. Potential CSRF detected.',
        },
      });
      return;
    }

    // 2. Authorization Code Validation
    if (!code || typeof code !== 'string') {
      logger.warn('Failed OAuth callback: missing authorization code');
      res.status(400).json({
        error: {
          code: 'INVALID_OAUTH_CODE',
          message: 'Authorization code was not provided in callback query.',
        },
      });
      return;
    }

    // 3. Process authentication
    const { user, rawToken } = await authService.handleGoogleCallback(
      code,
      state,
      expectedState
    );

    // 4. Set persistent session cookie
    res.cookie(googleConfig.SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: googleConfig.SESSION_MAX_AGE_MS,
    });

    logger.info('Authentication completed, redirecting to frontend', {
      userId: user.id,
      email: user.email,
    });

    // Redirect to frontend application
    res.redirect(`${googleConfig.WEB_ORIGIN}/`);
  } catch (error: any) {
    logger.error('Failed OAuth callback execution', {
      error: error.message,
      code: error.code,
    });

    if (error.code === 'INVALID_OAUTH_STATE' || error.code === 'INVALID_OAUTH_CODE') {
      res.status(400).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }

    if (error.code === 'USER_DISABLED') {
      res.status(403).json({
        error: {
          code: 'USER_DISABLED',
          message: 'This account has been disabled.',
        },
      });
      return;
    }

    next(error);
  }
}

/**
 * Returns authenticated user profile information.
 * Protected by requireAuth middleware.
 */
export async function getMe(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const user = req.user;

  if (!user) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      },
    });
    return;
  }

  res.status(200).json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      status: user.status,
      createdAt: user.createdAt,
    },
  });
}

/**
 * Logs out the user by invalidating the database session and clearing the cookie.
 */
export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawToken =
      req.cookies?.[googleConfig.SESSION_COOKIE_NAME] ||
      req.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (rawToken) {
      await sessionService.destroySession(rawToken);
    }

    res.clearCookie(googleConfig.SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });

    logger.info('User logged out', {
      userId: req.user?.id,
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Authenticates or registers a user with an email address.
 * Sets the persistent HttpOnly session cookie and returns user profile.
 */
export async function emailAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, name } = req.body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: 'A valid email address is required.',
        },
      });
      return;
    }

    const { user, rawToken } = await authService.loginOrCreateWithEmail(
      email,
      name
    );

    res.cookie(googleConfig.SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: googleConfig.SESSION_MAX_AGE_MS,
    });

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        status: user.status,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    if (error.code === 'INVALID_EMAIL') {
      res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: error.message || 'Invalid email address format.',
        },
      });
      return;
    }

    if (error.code === 'USER_DISABLED') {
      res.status(403).json({
        error: {
          code: 'USER_DISABLED',
          message: 'This account has been disabled.',
        },
      });
      return;
    }

    next(error);
  }
}
