'use client';

import { useState, useEffect, useCallback } from 'react';
import { AuthState } from '../types/auth';
import { authApiService } from '../services/auth.service';

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const loadUser = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const user = await authApiService.getMe();
      setState({
        user,
        isAuthenticated: user !== null,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: err.message || 'Failed to authenticate',
      });
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const loginWithGoogle = () => {
    window.location.href = authApiService.getGoogleLoginUrl();
  };

  const loginWithEmail = async (email: string, name?: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const user = await authApiService.loginWithEmail(email, name);
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return user;
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Failed to authenticate',
      }));
      throw err;
    }
  };

  const logout = async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    await authApiService.logout();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  };

  return {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    loginWithGoogle,
    loginWithEmail,
    logout,
    refreshUser: loadUser,
  };
}
