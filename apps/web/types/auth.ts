export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  status: 'ACTIVE' | 'DISABLED';
  createdAt?: string;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
