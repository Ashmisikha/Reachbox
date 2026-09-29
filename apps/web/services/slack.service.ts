import { getApiBaseUrl } from '../lib/api-config';

const getBase = () => getApiBaseUrl();

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
    return `${getBase()}/api/slack/connect`;
  },

  /**
   * Retrieves safe Slack connection status for the authenticated user.
   */
  async getStatus(): Promise<SlackStatusResponse | null> {
    try {
      const response = await fetch(`${getBase()}/api/slack/status`, {
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
      const response = await fetch(`${getBase()}/api/slack/disconnect`, {
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
