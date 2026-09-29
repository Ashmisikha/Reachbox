import { AuthUser } from '../types/auth';
import { getApiBaseUrl } from '../lib/api-config';

export const authApiService = {
  /**
   * Returns the direct URL to begin Google OAuth 2.0 authentication flow.
   */
  getGoogleLoginUrl(): string {
    return `${getApiBaseUrl()}/api/auth/google`;
  },

  /**
   * Fetches the current authenticated user from the backend session cookie.
   */
  async getMe(): Promise<AuthUser | null> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
      });

      if (response.status === 401) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch authenticated session: ${response.statusText}`);
      }

      const data = await response.json();
      return data.user as AuthUser;
    } catch {
      return null;
    }
  },

  /**
   * Authenticates or creates an account using email.
   */
  async loginWithEmail(email: string, name?: string): Promise<AuthUser> {
    const response = await fetch(`${getApiBaseUrl()}/api/auth/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, name }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error?.message || 'Failed to sign in with email');
    }

    const data = await response.json();
    return data.user as AuthUser;
  },

  /**
   * Invalidate the current session and clear authentication cookie.
   */
  async logout(): Promise<boolean> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
      });

      return response.ok;
    } catch {
      return false;
    }
  },
};
