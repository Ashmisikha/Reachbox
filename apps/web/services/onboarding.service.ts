const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface OnboardingStatus {
  setupCompleted: boolean;
  tourCompleted: boolean;
  workspaceName: string;
  userName?: string;
  minDelayMs: number;
  hourlyLimit: number;
  updatedAt: string;
}

export const onboardingApiService = {
  /**
   * Retrieves the current user's onboarding and tour completion status.
   */
  async getStatus(): Promise<OnboardingStatus | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/onboarding/status`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) return null;
      const res = await response.json();
      return res.data as OnboardingStatus;
    } catch {
      return null;
    }
  },

  /**
   * Updates workspace setup details and marks setup complete.
   */
  async saveSetup(data: {
    setupCompleted?: boolean;
    workspaceName?: string;
    userName?: string;
    minDelayMs?: number;
    hourlyLimit?: number;
  }): Promise<OnboardingStatus | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/onboarding/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) return null;
      const res = await response.json();
      return res.data as OnboardingStatus;
    } catch {
      return null;
    }
  },

  /**
   * Updates product walkthrough tour completion status.
   */
  async saveTour(tourCompleted: boolean): Promise<OnboardingStatus | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/onboarding/tour`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ tourCompleted }),
      });

      if (!response.ok) return null;
      const res = await response.json();
      return res.data as OnboardingStatus;
    } catch {
      return null;
    }
  },

  /**
   * Resets tour completed status for immediate replay.
   */
  async replayTour(): Promise<OnboardingStatus | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/onboarding/tour/replay`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) return null;
      const res = await response.json();
      return res.data as OnboardingStatus;
    } catch {
      return null;
    }
  },

  /**
   * Resets workspace setup status to restart the wizard.
   */
  async resetSetup(): Promise<OnboardingStatus | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/onboarding/setup/reset`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) return null;
      const res = await response.json();
      return res.data as OnboardingStatus;
    } catch {
      return null;
    }
  },
};
