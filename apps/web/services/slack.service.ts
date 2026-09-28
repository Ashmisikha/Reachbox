const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface SlackStatusResponse {
  connected: boolean;
  teamName?: string;
  teamId?: string;
  channelName?: string;
  connectedAt?: string;
  status: string;
}

export const slackApiService = {
  /**
   * Returns the direct URL to begin Slack OAuth 2.0 flow.
   */
  getConnectUrl(): string {
    return `${API_BASE_URL}/api/slack/connect`;
  },

  /**
   * Retrieves safe Slack connection status for the authenticated user.
   */
  async getStatus(): Promise<SlackStatusResponse | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/slack/status`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as SlackStatusResponse;
    } catch {
      return null;
    }
  },

  /**
   * Disconnects the current user's Slack workspace.
   */
  async disconnect(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/slack/disconnect`, {
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
