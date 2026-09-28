import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import prisma from '../src/lib/prisma';
import { googleConfig, googleConfigSchema } from '../src/config/google';
import {
  googleOAuthService,
  GoogleOAuthService,
} from '../src/services/auth/google-oauth.service';
import { sessionService } from '../src/services/auth/session.service';
import { authService, AuthService } from '../src/services/auth/auth.service';
import { emailSearchService } from '../src/services/search';
import { logger } from '../src/lib/logger';
import { UserStatus } from '@prisma/client';

describe('Phase 5 — Real Google OAuth & User Authentication', () => {
  beforeAll(async () => {
    // Ensure clean test database state
    await prisma.session.deleteMany();
  });

  afterAll(async () => {
    // Cleanup sessions created during tests
    await prisma.session.deleteMany();
  });

  // ============================================================================
  // A. Google OAuth Configuration Validation
  // ============================================================================
  describe('A. Google OAuth Configuration Validation', () => {
    it('validates default Google OAuth configuration schema', () => {
      const parsed = googleConfigSchema.parse({});
      expect(parsed.GOOGLE_CLIENT_ID).toBeDefined();
      expect(parsed.GOOGLE_CLIENT_SECRET).toBeDefined();
      expect(parsed.GOOGLE_REDIRECT_URI).toBeDefined();
      expect(parsed.SESSION_COOKIE_NAME).toBe('reachinbox_sid');
      expect(parsed.SESSION_MAX_AGE_MS).toBe(7 * 24 * 60 * 60 * 1000);
      expect(parsed.OAUTH_STATE_COOKIE_NAME).toBe('reachinbox_oauth_state');
    });

    it('rejects invalid numerical session max age', () => {
      expect(() => {
        googleConfigSchema.parse({ SESSION_MAX_AGE_MS: 'not-a-number' });
      }).toThrow();
    });
  });

  // ============================================================================
  // B & C. Google Authorization URL & OAuth State Generation
  // ============================================================================
  describe('B & C. Google Authorization URL & State Generation', () => {
    it('C. generates a cryptographically random, unique state token', () => {
      const state1 = googleOAuthService.generateState();
      const state2 = googleOAuthService.generateState();

      expect(typeof state1).toBe('string');
      expect(state1.length).toBe(64); // 32 bytes hex = 64 characters
      expect(state1).not.toBe(state2);
    });

    it('B. generates valid Google OAuth 2.0 authorization URL with required parameters', () => {
      const state = googleOAuthService.generateState();
      const authUrl = googleOAuthService.generateAuthUrl(state);

      expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(authUrl).toContain(`client_id=${encodeURIComponent(googleConfig.GOOGLE_CLIENT_ID)}`);
      expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(googleConfig.GOOGLE_REDIRECT_URI)}`);
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('scope=openid+email+profile');
      expect(authUrl).toContain(`state=${state}`);
      expect(authUrl).toContain('access_type=offline');
    });

    it('B. throws error if state is missing when generating authorization URL', () => {
      expect(() => googleOAuthService.generateAuthUrl('')).toThrow(
        'OAuth state is required for CSRF protection'
      );
    });

    it('GET /api/auth/google initiates flow and redirects with state cookie', async () => {
      const res = await request(app).get('/api/auth/google');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('https://accounts.google.com/o/oauth2/v2/auth');

      // Verify state cookie is set with HttpOnly and Lax
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const stateCookie = cookies.find((c: string) =>
        c.startsWith(`${googleConfig.OAUTH_STATE_COOKIE_NAME}=`)
      );
      expect(stateCookie).toBeDefined();
      expect(stateCookie).toContain('HttpOnly');
      expect(stateCookie).toContain('Path=/');
    });
  });

  // ============================================================================
  // D & E. OAuth State Mismatch & Missing State Rejected (CSRF Protection)
  // ============================================================================
  describe('D & E. CSRF State Validation', () => {
    it('D. rejects callback when state parameter does not match stored state cookie', async () => {
      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({ code: 'valid-auth-code', state: 'attacker-manipulated-state' })
        .set('Cookie', [`${googleConfig.OAUTH_STATE_COOKIE_NAME}=legitimate-state-token`]);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_OAUTH_STATE');
      expect(res.body.error.message).toContain('State mismatch');
    });

    it('E. rejects callback when state query parameter is missing', async () => {
      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({ code: 'valid-auth-code' })
        .set('Cookie', [`${googleConfig.OAUTH_STATE_COOKIE_NAME}=legitimate-state-token`]);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_OAUTH_STATE');
    });

    it('E. rejects callback when state cookie is missing (expired or CSRF attempt)', async () => {
      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({ code: 'valid-auth-code', state: 'some-state' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_OAUTH_STATE');
    });

    it('rejects callback when code is missing', async () => {
      const validState = 'shared-secret-state-123';
      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({ state: validState })
        .set('Cookie', [`${googleConfig.OAUTH_STATE_COOKIE_NAME}=${validState}`]);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_OAUTH_CODE');
    });
  });

  // ============================================================================
  // F & G. Google Token Exchange & Identity Extraction
  // ============================================================================
  describe('F & G. Google Token Exchange & Identity Extraction', () => {
    it('F. exchangeCodeForTokens makes POST request to token endpoint and parses tokens', async () => {
      const mockOAuth = new GoogleOAuthService('test-id', 'test-sec', 'http://test/cb');

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'mock-google-access-token-xyz',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid email profile',
        }),
      } as any);

      const tokens = await mockOAuth.exchangeCodeForTokens('mock-code-123');

      expect(tokens.access_token).toBe('mock-google-access-token-xyz');
      expect(tokens.token_type).toBe('Bearer');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      global.fetch = originalFetch;
    });

    it('G. fetchUserProfile extracts subject ID, verified email, name, and picture', async () => {
      const mockOAuth = new GoogleOAuthService('test-id', 'test-sec', 'http://test/cb');

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          sub: 'google-sub-99887766',
          email: 'Verified.User@Gmail.Com',
          email_verified: true,
          name: 'Verified User',
          picture: 'https://lh3.googleusercontent.com/a/avatar.jpg',
        }),
      } as any);

      const profile = await mockOAuth.fetchUserProfile('mock-valid-token');

      expect(profile.id).toBe('google-sub-99887766');
      expect(profile.email).toBe('verified.user@gmail.com');
      expect(profile.verified_email).toBe(true);
      expect(profile.name).toBe('Verified User');
      expect(profile.picture).toBe('https://lh3.googleusercontent.com/a/avatar.jpg');

      global.fetch = originalFetch;
    });

    it('G. rejects Google profile if email is unverified', async () => {
      const mockOAuth = new GoogleOAuthService('test-id', 'test-sec', 'http://test/cb');

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          sub: 'google-sub-unverified',
          email: 'unverified@gmail.com',
          email_verified: false,
          name: 'Unverified User',
        }),
      } as any);

      await expect(mockOAuth.fetchUserProfile('token')).rejects.toThrow(
        'Google account email is not verified'
      );

      global.fetch = originalFetch;
    });

    it('G. rejects Google profile if subject ID is missing', async () => {
      const mockOAuth = new GoogleOAuthService('test-id', 'test-sec', 'http://test/cb');

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          email: 'missing-sub@gmail.com',
          email_verified: true,
        }),
      } as any);

      await expect(mockOAuth.fetchUserProfile('token')).rejects.toThrow(
        'Google profile is missing subject (sub) identifier'
      );

      global.fetch = originalFetch;
    });
  });

  // ============================================================================
  // H, I, J. User Creation, Linking & Stable Identity (No Duplicates)
  // ============================================================================
  describe('H, I, J. User Resolution & Deduplication', () => {
    it('I. creates a new active User in PostgreSQL on first Google OAuth login', async () => {
      const googleId = `gid-new-${Date.now()}`;
      const email = `new.google.user.${Date.now()}@gmail.com`;

      const spyExchange = vi
        .spyOn(googleOAuthService, 'exchangeCodeForTokens')
        .mockResolvedValueOnce({
          access_token: 'mock-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid email profile',
        });

      const spyProfile = vi
        .spyOn(googleOAuthService, 'fetchUserProfile')
        .mockResolvedValueOnce({
          id: googleId,
          email,
          verified_email: true,
          name: 'Brand New User',
          picture: 'https://lh3.googleusercontent.com/avatar-new.jpg',
        });

      const result = await authService.handleGoogleCallback(
        'code-for-new-user',
        'valid-state',
        'valid-state'
      );

      expect(result.user).toBeDefined();
      expect(result.user.googleId).toBe(googleId);
      expect(result.user.email).toBe(email);
      expect(result.user.name).toBe('Brand New User');
      expect(result.user.status).toBe(UserStatus.ACTIVE);
      expect(result.rawToken).toBeDefined();

      // Verify persisted in PostgreSQL
      const persisted = await prisma.user.findUnique({
        where: { id: result.user.id },
      });
      expect(persisted).not.toBeNull();
      expect(persisted?.googleId).toBe(googleId);

      spyExchange.mockRestore();
      spyProfile.mockRestore();
    });

    it('H & J. repeated login with the same Google subject ID returns same user without duplicate', async () => {
      const googleId = `gid-dedup-${Date.now()}`;
      const email = `dedup.${Date.now()}@gmail.com`;

      // 1. Initial Login
      vi.spyOn(googleOAuthService, 'exchangeCodeForTokens').mockResolvedValue({
        access_token: 'mock-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid',
      });

      vi.spyOn(googleOAuthService, 'fetchUserProfile').mockResolvedValue({
        id: googleId,
        email,
        verified_email: true,
        name: 'Dedup User Initial',
      });

      const initialResult = await authService.handleGoogleCallback(
        'code-1',
        'state-1',
        'state-1'
      );

      const countAfterFirst = await prisma.user.count({ where: { googleId } });
      expect(countAfterFirst).toBe(1);

      // 2. Subsequent Login with updated name
      vi.spyOn(googleOAuthService, 'fetchUserProfile').mockResolvedValue({
        id: googleId,
        email,
        verified_email: true,
        name: 'Dedup User Updated Name',
      });

      const secondResult = await authService.handleGoogleCallback(
        'code-2',
        'state-2',
        'state-2'
      );

      const countAfterSecond = await prisma.user.count({ where: { googleId } });
      expect(countAfterSecond).toBe(1); // STILL EXACTLY 1 USER RECORD!
      expect(secondResult.user.id).toBe(initialResult.user.id);
      expect(secondResult.user.name).toBe('Dedup User Updated Name');

      vi.restoreAllMocks();
    });

    it('links Google ID to pre-existing email account without Google ID', async () => {
      const sharedEmail = `pre-existing-${Date.now()}@example.com`;
      const googleId = `gid-link-${Date.now()}`;

      // Pre-create user without googleId
      const preExistingUser = await prisma.user.create({
        data: {
          email: sharedEmail,
          name: 'Manual Account',
          status: UserStatus.ACTIVE,
        },
      });
      expect(preExistingUser.googleId).toBeNull();

      vi.spyOn(googleOAuthService, 'exchangeCodeForTokens').mockResolvedValueOnce({
        access_token: 'token-link',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid',
      });

      vi.spyOn(googleOAuthService, 'fetchUserProfile').mockResolvedValueOnce({
        id: googleId,
        email: sharedEmail,
        verified_email: true,
        name: 'Manual Account Linked',
      });

      const result = await authService.handleGoogleCallback(
        'code-link',
        'state-link',
        'state-link'
      );

      expect(result.user.id).toBe(preExistingUser.id);
      expect(result.user.googleId).toBe(googleId);

      vi.restoreAllMocks();
    });
  });

  // ============================================================================
  // K, L, M, N. Session Creation, Storage, Lookup, and Expiration
  // ============================================================================
  describe('K, L, M, N. Session Persistence & Security', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await prisma.user.create({
        data: {
          email: `session-test-${Date.now()}-${Math.random()}@example.com`,
          name: 'Session Test User',
          status: UserStatus.ACTIVE,
        },
      });
    });

    it('K. creates session with hashed token; never stores raw token in PostgreSQL', async () => {
      const { rawToken, session } = await sessionService.createSession(testUser.id);

      expect(typeof rawToken).toBe('string');
      expect(rawToken.length).toBe(64); // 32 bytes in hex

      // Look up raw database record
      const dbRecord = await prisma.session.findUnique({
        where: { id: session.id },
      });

      expect(dbRecord).not.toBeNull();
      // DB record must store the SHA-256 hash, NOT the raw token
      expect(dbRecord?.tokenHash).toBe(sessionService.hashToken(rawToken));
      expect(dbRecord?.tokenHash).not.toBe(rawToken);
    });

    it('L. resolves session by raw token and loads associated user', async () => {
      const { rawToken } = await sessionService.createSession(testUser.id);
      const resolved = await sessionService.resolveSession(rawToken);

      expect(resolved).not.toBeNull();
      expect(resolved?.userId).toBe(testUser.id);
      expect(resolved?.user.id).toBe(testUser.id);
      expect(resolved?.user.email).toBe(testUser.email);
    });

    it('M. rejects expired session and purges it', async () => {
      // Create session with TTL = -1000ms (already expired)
      const { rawToken } = await sessionService.createSession(testUser.id, -1000);

      const resolved = await sessionService.resolveSession(rawToken);
      expect(resolved).toBeNull();

      // Verify it was purged from the database
      const dbCheck = await prisma.session.findUnique({
        where: { tokenHash: sessionService.hashToken(rawToken) },
      });
      expect(dbCheck).toBeNull();
    });

    it('N. rejects invalid, malformed, or nonexistent raw session tokens', async () => {
      expect(await sessionService.resolveSession('')).toBeNull();
      expect(await sessionService.resolveSession('nonexistent-token-12345')).toBeNull();
      expect(await sessionService.resolveSession(null as any)).toBeNull();
    });

    it('rejects session if associated user has DISABLED status', async () => {
      const disabledUser = await prisma.user.create({
        data: {
          email: `disabled-${Date.now()}@example.com`,
          name: 'Disabled User',
          status: UserStatus.DISABLED,
        },
      });

      const { rawToken } = await sessionService.createSession(disabledUser.id);
      const resolved = await sessionService.resolveSession(rawToken);
      expect(resolved).toBeNull();
    });
  });

  // ============================================================================
  // O & P. GET /api/auth/me (Authenticated vs Unauthenticated)
  // ============================================================================
  describe('O & P. GET /api/auth/me', () => {
    it('P. returns 401 UNAUTHORIZED when unauthenticated', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toContain('Authentication required');
    });

    it('O. returns 200 with authenticated user profile when valid cookie is provided', async () => {
      const user = await prisma.user.create({
        data: {
          email: `me-test-${Date.now()}@example.com`,
          name: 'Authenticated User',
          status: UserStatus.ACTIVE,
        },
      });

      const { rawToken } = await sessionService.createSession(user.id);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${googleConfig.SESSION_COOKIE_NAME}=${rawToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe(user.id);
      expect(res.body.user.email).toBe(user.email);
      expect(res.body.user.name).toBe('Authenticated User');
      expect(res.body.user.status).toBe('ACTIVE');
    });
  });

  // ============================================================================
  // Q & R. Logout Invalidation and Cookie Clearing
  // ============================================================================
  describe('Q & R. POST /api/auth/logout', () => {
    it('Q & R. invalidates PostgreSQL session and clears session cookie on logout', async () => {
      const user = await prisma.user.create({
        data: {
          email: `logout-test-${Date.now()}@example.com`,
          name: 'Logout User',
          status: UserStatus.ACTIVE,
        },
      });

      const { rawToken, session } = await sessionService.createSession(user.id);

      // Verify session exists
      const beforeLogout = await sessionService.resolveSession(rawToken);
      expect(beforeLogout).not.toBeNull();

      // Execute logout request
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [`${googleConfig.SESSION_COOKIE_NAME}=${rawToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // R. Verify cookie was cleared in response header
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const clearedCookie = cookies.find((c: string) =>
        c.startsWith(`${googleConfig.SESSION_COOKIE_NAME}=;`) ||
        c.includes(`${googleConfig.SESSION_COOKIE_NAME}=;`)
      );
      expect(clearedCookie).toBeDefined();

      // Q. Verify session is permanently deleted from PostgreSQL
      const afterLogout = await sessionService.resolveSession(rawToken);
      expect(afterLogout).toBeNull();

      const dbRecord = await prisma.session.findUnique({
        where: { id: session.id },
      });
      expect(dbRecord).toBeNull();

      // Subsequent /api/auth/me must return 401
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${googleConfig.SESSION_COOKIE_NAME}=${rawToken}`]);
      expect(meRes.status).toBe(401);
    });
  });

  // ============================================================================
  // S, T, U, V. Protected Search Route & Ownership Scoping
  // ============================================================================
  describe('S, T, U, V. Protected Route & Search User Ownership', () => {
    let userA: any;
    let userB: any;
    let cookieA: string;
    let cookieB: string;

    beforeAll(async () => {
      userA = await prisma.user.create({
        data: {
          email: `tenant-a-${Date.now()}@example.com`,
          name: 'Tenant User A',
          status: UserStatus.ACTIVE,
        },
      });
      const sessionA = await sessionService.createSession(userA.id);
      cookieA = `${googleConfig.SESSION_COOKIE_NAME}=${sessionA.rawToken}`;

      userB = await prisma.user.create({
        data: {
          email: `tenant-b-${Date.now()}@example.com`,
          name: 'Tenant User B',
          status: UserStatus.ACTIVE,
        },
      });
      const sessionB = await sessionService.createSession(userB.id);
      cookieB = `${googleConfig.SESSION_COOKIE_NAME}=${sessionB.rawToken}`;
    });

    it('S. GET /api/emails/search rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/emails/search').query({ q: 'invoice' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('U. Search automatically scopes Elasticsearch query to authenticated user ID', async () => {
      const spySearch = vi.spyOn(emailSearchService, 'search').mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/emails/search')
        .set('Cookie', [cookieA])
        .query({ q: 'welcome' });

      expect(res.status).toBe(200);
      expect(spySearch).toHaveBeenCalledTimes(1);

      // Verify that the search service received User A's ID
      const passedQuery = spySearch.mock.calls[0][0];
      expect(passedQuery.userId).toBe(userA.id);

      spySearch.mockRestore();
    });

    it('V. Client-supplied userId query parameter CANNOT bypass ownership (overridden by server)', async () => {
      const spySearch = vi.spyOn(emailSearchService, 'search').mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });

      // User A attempts to inspect User B's emails by passing User B's ID in query
      const res = await request(app)
        .get('/api/emails/search')
        .set('Cookie', [cookieA])
        .query({ q: 'invoice', userId: userB.id });

      expect(res.status).toBe(200);
      expect(spySearch).toHaveBeenCalledTimes(1);

      // SERVER MUST OVERRIDE CLIENT-SUPPLIED userId WITH AUTHENTICATED USER'S ID!
      const passedQuery = spySearch.mock.calls[0][0];
      expect(passedQuery.userId).toBe(userA.id);
      expect(passedQuery.userId).not.toBe(userB.id);

      spySearch.mockRestore();
    });

    it('T. User B searching cannot observe User A emails', async () => {
      const spySearch = vi.spyOn(emailSearchService, 'search').mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });

      const res = await request(app)
        .get('/api/emails/search')
        .set('Cookie', [cookieB])
        .query({ q: 'deals' });

      expect(res.status).toBe(200);
      const passedQuery = spySearch.mock.calls[0][0];
      expect(passedQuery.userId).toBe(userB.id);

      spySearch.mockRestore();
    });
  });

  // ============================================================================
  // W. Security & Audit: No Secrets or Tokens Appear in Logs
  // ============================================================================
  describe('W. Security & Audit: No Secrets or Tokens in Logs', () => {
    it('W. verifies authentication logs do not leak auth codes, access tokens, or session tokens', async () => {
      const spyInfo = vi.spyOn(logger, 'info');
      const spyWarn = vi.spyOn(logger, 'warn');
      const spyError = vi.spyOn(logger, 'error');

      const secretAuthCode = 'confidential-auth-code-secret-42';
      const secretAccessToken = 'confidential-google-access-token-99';
      const secretSessionToken = 'confidential-raw-session-token-88';

      // 1. Google Auth Start
      await request(app).get('/api/auth/google');

      // 2. OAuth Callback
      vi.spyOn(googleOAuthService, 'exchangeCodeForTokens').mockResolvedValueOnce({
        access_token: secretAccessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid',
      });
      vi.spyOn(googleOAuthService, 'fetchUserProfile').mockResolvedValueOnce({
        id: `gid-audit-${Date.now()}`,
        email: `audit.${Date.now()}@example.com`,
        verified_email: true,
        name: 'Audit User',
      });
      vi.spyOn(sessionService, 'generateRawToken').mockReturnValueOnce(secretSessionToken);

      const state = 'audit-state-token';
      await request(app)
        .get('/api/auth/google/callback')
        .query({ code: secretAuthCode, state })
        .set('Cookie', [`${googleConfig.OAUTH_STATE_COOKIE_NAME}=${state}`]);

      // Inspect all logger calls
      const allLogCalls = [
        ...spyInfo.mock.calls,
        ...spyWarn.mock.calls,
        ...spyError.mock.calls,
      ];

      for (const call of allLogCalls) {
        const logContent = JSON.stringify(call);
        expect(logContent).not.toContain(secretAuthCode);
        expect(logContent).not.toContain(secretAccessToken);
        expect(logContent).not.toContain(secretSessionToken);
        expect(logContent).not.toContain(googleConfig.GOOGLE_CLIENT_SECRET);
      }

      vi.restoreAllMocks();
    });
  });
});
