import crypto from 'crypto';
import { googleConfig } from '../../config/google';
import { GoogleTokenResponse, GoogleUserProfile } from './auth.types';

export class GoogleOAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(
    clientId: string = googleConfig.GOOGLE_CLIENT_ID,
    clientSecret: string = googleConfig.GOOGLE_CLIENT_SECRET,
    redirectUri: string = googleConfig.GOOGLE_REDIRECT_URI
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  /**
   * Generates a cryptographically random OAuth state token for CSRF protection.
   */
  public generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generates the official Google OAuth 2.0 authorization URL.
   */
  public generateAuthUrl(state: string): string {
    if (!state) {
      throw new Error('OAuth state is required for CSRF protection');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for Google access token and token details.
   */
  public async exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
    if (!code) {
      throw new Error('Authorization code is required');
    }

    const tokenEndpoint = 'https://oauth2.googleapis.com/token';
    const body = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDesc = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDesc = errorJson.error_description || errorJson.error || errorText;
      } catch {
        // use raw text
      }
      throw new Error(`Google token exchange failed: ${errorDesc}`);
    }

    const data = (await response.json()) as GoogleTokenResponse;
    if (!data.access_token) {
      throw new Error('Google token response did not contain an access_token');
    }

    return data;
  }

  /**
   * Fetches the user profile from Google OpenID Connect endpoint using the access token.
   */
  public async fetchUserProfile(accessToken: string): Promise<GoogleUserProfile> {
    if (!accessToken) {
      throw new Error('Access token is required to fetch Google user profile');
    }

    const userInfoEndpoint = 'https://openidconnect.googleapis.com/v1/userinfo';
    const response = await fetch(userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch Google user profile: ${errorText}`);
    }

    const data = (await response.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      verified_email?: boolean;
      name?: string;
      picture?: string;
    };

    const sub = data.sub;
    if (!sub || typeof sub !== 'string') {
      throw new Error('Google profile is missing subject (sub) identifier');
    }

    const email = data.email;
    if (!email || typeof email !== 'string') {
      throw new Error('Google profile is missing email');
    }

    const isVerified = data.email_verified === true || data.verified_email === true;
    if (!isVerified) {
      throw new Error('Google account email is not verified');
    }

    const fallbackName = email.split('@')[0] || 'User';
    return {
      id: sub,
      email: email.toLowerCase().trim(),
      verified_email: true,
      name: data.name || fallbackName,
      picture: data.picture || undefined,
    };
  }
}

export const googleOAuthService = new GoogleOAuthService();
