const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export type EmbedKind = 'welcome' | 'rules' | 'services' | 'pricing' | 'ticket';

export interface EmbedPayload {
  title?: string;
  description?: string;
  color?: string;
  authorName?: string;
  authorIconUrl?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  footerText?: string;
  footerIconUrl?: string;
  timestamp?: boolean;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  buttons?: Array<{
    label: string;
    customId: string;
    style?: 'Primary' | 'Secondary' | 'Success' | 'Danger';
    emoji?: string;
  }>;
}

export const api = {
  me: () => request<import('../types').AuthUser>('/api/auth/me'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  guilds: () =>
    request<{ guilds: import('../types').GuildSummary[] }>('/api/guilds'),
  overview: (guildId: string) =>
    request<import('../types').GuildOverview>(`/api/guilds/${guildId}/overview`),
  activity: (guildId: string, limit = 50) =>
    request<{ activity: import('../types').ActivityItem[] }>(
      `/api/guilds/${guildId}/activity?limit=${limit}`,
    ),
  botStatus: (guildId: string) =>
    request<{
      online: boolean;
      tag: string | null;
      ping: number;
      uptimeMs: number | null;
      guildCount: number;
    }>(`/api/guilds/${guildId}/bot-status`),

  channels: (guildId: string) =>
    request<{
      categories: Array<{ id: string; name: string; type: string; position: number }>;
      text: Array<{
        id: string;
        name: string;
        type: string;
        parentId: string | null;
        topic: string | null;
        position: number;
      }>;
      voice: Array<{
        id: string;
        name: string;
        type: string;
        parentId: string | null;
        position: number;
      }>;
    }>(`/api/guilds/${guildId}/channels`),
  createChannel: (
    guildId: string,
    body: { name: string; type: 'text' | 'voice' | 'category'; parentId?: string | null; topic?: string },
  ) => request(`/api/guilds/${guildId}/channels`, { method: 'POST', body: JSON.stringify(body) }),
  deleteChannel: (guildId: string, channelId: string) =>
    request(`/api/guilds/${guildId}/channels/${channelId}`, { method: 'DELETE' }),

  roles: (guildId: string) =>
    request<{
      roles: Array<{
        id: string;
        name: string;
        color: string;
        position: number;
        hoist: boolean;
        mentionable: boolean;
        managed: boolean;
        members: number;
      }>;
    }>(`/api/guilds/${guildId}/roles`),
  createRole: (guildId: string, body: { name: string; color?: string; hoist?: boolean; mentionable?: boolean }) =>
    request(`/api/guilds/${guildId}/roles`, { method: 'POST', body: JSON.stringify(body) }),
  deleteRole: (guildId: string, roleId: string) =>
    request(`/api/guilds/${guildId}/roles/${roleId}`, { method: 'DELETE' }),

  members: (guildId: string, q?: string) =>
    request<{
      members: Array<{
        id: string;
        username: string;
        displayName: string;
        avatarUrl: string;
        bot: boolean;
        joinedAt: string | null;
        roles: Array<{ id: string; name: string; color: string }>;
      }>;
    }>(`/api/guilds/${guildId}/members${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  timeoutMember: (guildId: string, userId: string, minutes: number) =>
    request(`/api/guilds/${guildId}/members/${userId}/timeout`, {
      method: 'POST',
      body: JSON.stringify({ minutes }),
    }),
  kickMember: (guildId: string, userId: string) =>
    request(`/api/guilds/${guildId}/members/${userId}/kick`, { method: 'POST', body: '{}' }),

  embed: (guildId: string, kind: EmbedKind) =>
    request<{
      kind: EmbedKind;
      channelName: string;
      channelId: string | null;
      messageId: string | null;
      payload: EmbedPayload;
    }>(`/api/guilds/${guildId}/embeds/${kind}`),
  saveEmbed: (guildId: string, kind: EmbedKind, payload: EmbedPayload) =>
    request(`/api/guilds/${guildId}/embeds/${kind}`, {
      method: 'PUT',
      body: JSON.stringify({ payload }),
    }),

  ticketSettings: (guildId: string) =>
    request<{
      ticketsEnabled: boolean;
      ticketCategoryId: string | null;
      logChannelId: string | null;
      staffRoleIds: string[];
      categories: Array<{ id: string; name: string }>;
      roles: Array<{ id: string; name: string; color: string }>;
    }>(`/api/guilds/${guildId}/tickets/settings`),
  saveTicketSettings: (
    guildId: string,
    body: {
      ticketsEnabled?: boolean;
      ticketCategoryId?: string | null;
      logChannelId?: string | null;
      staffRoleIds?: string[];
    },
  ) =>
    request<{
      ticketsEnabled: boolean;
      ticketCategoryId: string | null;
      logChannelId: string | null;
      staffRoleIds: string[];
    }>(`/api/guilds/${guildId}/tickets/settings`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  ticketCategories: (guildId: string) =>
    request<{
      categories: Array<{ id: string; label: string; emoji: string; enabled?: boolean }>;
      defaults: Array<{ id: string; label: string; emoji: string; enabled?: boolean }>;
    }>(`/api/guilds/${guildId}/tickets/categories`),
  saveTicketCategories: (
    guildId: string,
    categories: Array<{ id: string; label: string; emoji: string; enabled?: boolean }>,
  ) =>
    request<{ categories: Array<{ id: string; label: string; emoji: string; enabled?: boolean }> }>(
      `/api/guilds/${guildId}/tickets/categories`,
      { method: 'PUT', body: JSON.stringify({ categories }) },
    ),

  botGeneral: (guildId: string) =>
    request<{
      botTag: string | null;
      botId: string | null;
      presence: string;
      logChannelId: string | null;
      textChannels: Array<{ id: string; name: string }>;
    }>(`/api/guilds/${guildId}/bot/general`),
  saveBotGeneral: (guildId: string, body: { logChannelId?: string | null }) =>
    request<{ logChannelId: string | null }>(`/api/guilds/${guildId}/bot/general`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  security: (guildId: string) =>
    request<{
      you: {
        id: string;
        username: string;
        isOwner: boolean;
        permissions: string[];
        roles: string[];
      };
      policy: Record<string, string>;
      recentAdminActions: import('../types').ActivityItem[];
    }>(`/api/guilds/${guildId}/security`),
  integrations: (guildId: string) =>
    request<{
      discord: {
        connected: boolean;
        botTag: string | null;
        guildName: string | null;
        inviteHint: string;
      };
      webhooks: { status: string; note: string };
      oauth: { scopes: string[]; dashboardOrigin: string | null };
    }>(`/api/guilds/${guildId}/integrations`),
};
