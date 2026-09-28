import prisma from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { googleOAuthService, GoogleOAuthService } from './google-oauth.service';
import { sessionService, SessionService } from './session.service';
import { AuthCallbackResult, AuthenticatedUser } from './auth.types';
import { UserStatus } from '@prisma/client';

export class AuthService {
  private googleOAuth: GoogleOAuthService;
  private session: SessionService;

  constructor(
    googleOAuth: GoogleOAuthService = googleOAuthService,
    session: SessionService = sessionService
  ) {
    this.googleOAuth = googleOAuth;
    this.session = session;
  }

  /**
   * Processes the Google OAuth callback:
   * 1. Validates state for CSRF protection
   * 2. Exchanges code for tokens
   * 3. Fetches verified Google identity
   * 4. Finds or creates persistent User record using stable Google subject ID
   * 5. Creates persistent PostgreSQL session
   */
  public async handleGoogleCallback(
    code: string,
    state: string,
    expectedState: string
  ): Promise<AuthCallbackResult> {
    // 1. State / CSRF validation
    if (!state || !expectedState || state !== expectedState) {
      logger.warn('Failed OAuth callback: CSRF state mismatch or missing state');
      const error = new Error('OAuth state mismatch or expired. Potential CSRF detected.');
      (error as any).code = 'INVALID_OAUTH_STATE';
      throw error;
    }

    if (!code) {
      logger.warn('Failed OAuth callback: Missing authorization code');
      const error = new Error('Missing OAuth authorization code');
      (error as any).code = 'INVALID_OAUTH_CODE';
      throw error;
    }

    // 2. Token exchange
    let tokenData;
    try {
      tokenData = await this.googleOAuth.exchangeCodeForTokens(code);
    } catch (err: any) {
      logger.error('Failed OAuth callback: Token exchange failed', {
        error: err.message,
      });
      throw err;
    }

    // 3. User info retrieval
    let profile;
    try {
      profile = await this.googleOAuth.fetchUserProfile(tokenData.access_token);
    } catch (err: any) {
      logger.error('Failed OAuth callback: User profile fetch failed', {
        error: err.message,
      });
      throw err;
    }

    // 4. Stable User resolution (Google subject ID first, then email fallback linking)
    let user = await prisma.user.findUnique({
      where: { googleId: profile.id },
    });

    if (user) {
      // Existing Google user login: update profile info if changed
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: profile.name,
          avatarUrl: profile.picture,
          // In case user's Google email was updated
          email: profile.email,
        },
      });
    } else {
      // Check if an existing account exists by email to link Google ID
      const existingByEmail = await prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (existingByEmail) {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleId: profile.id,
            name: profile.name || existingByEmail.name,
            avatarUrl: profile.picture || existingByEmail.avatarUrl,
          },
        });
      } else {
        // New Google user creation
        user = await prisma.user.create({
          data: {
            googleId: profile.id,
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.picture,
            status: UserStatus.ACTIVE,
          },
        });
      }
    }

    if (user.status !== UserStatus.ACTIVE) {
      const error = new Error('User account is disabled');
      (error as any).code = 'USER_DISABLED';
      throw error;
    }

    // 5. Create persistent session
    const { rawToken, session } = await this.session.createSession(user.id);

    logger.info('Successful authentication via Google OAuth', {
      userId: user.id,
      email: user.email,
    });

    return {
      user: user as AuthenticatedUser,
      session,
      rawToken,
    };
  }
}

export const authService = new AuthService();
