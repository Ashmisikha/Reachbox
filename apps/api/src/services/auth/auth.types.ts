import { UserStatus } from '@prisma/client';

export interface GoogleUserProfile {
  id: string; // Google subject (sub) identifier
  email: string;
  verified_email: boolean;
  name: string;
  picture?: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

export interface AuthenticatedUser {
  id: string;
  googleId: string | null;
  email: string;
  name: string;
  avatarUrl: string | null;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionWithUser {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  user: AuthenticatedUser;
}

export interface AuthCallbackResult {
  user: AuthenticatedUser;
  session: SessionWithUser;
  rawToken: string;
}
