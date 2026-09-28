import { Request, Response, NextFunction } from 'express';
import { sessionService } from '../services/auth/session.service';
import { AuthenticatedUser, SessionWithUser } from '../services/auth/auth.types';
import { googleConfig } from '../config/google';
import { logger } from '../lib/logger';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      session?: SessionWithUser;
    }
  }
}

/**
 * Extracts raw session token from the HttpOnly session cookie,
 * or fallback to Authorization header for API testing clients.
 */
function extractToken(req: Request): string | null {
  if (req.cookies && req.cookies[googleConfig.SESSION_COOKIE_NAME]) {
    return req.cookies[googleConfig.SESSION_COOKIE_NAME];
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}

/**
 * Middleware that strictly enforces authenticated user session.
 * Rejects unauthenticated requests with HTTP 401 Unauthorized.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawToken = extractToken(req);

    if (!rawToken) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. No session cookie provided.',
        },
      });
      return;
    }

    const session = await sessionService.resolveSession(rawToken);

    if (!session) {
      logger.warn('Authentication rejected: invalid or expired session token', {
        path: req.originalUrl,
      });

      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired session. Please log in again.',
        },
      });
      return;
    }

    // Attach resolved user and session to request context
    req.user = session.user;
    req.session = session;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware that attaches user context if a valid session exists,
 * but allows unauthenticated requests to proceed.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawToken = extractToken(req);
    if (rawToken) {
      const session = await sessionService.resolveSession(rawToken);
      if (session) {
        req.user = session.user;
        req.session = session;
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}
