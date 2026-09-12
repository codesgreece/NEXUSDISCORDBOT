export interface AuthUser {
  id: string;
  username: string;
  globalName: string | null;
  discriminator: string;
  avatarUrl: string;
}

export interface GuildSummary {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  botInGuild: boolean;
  canManage: boolean;
  iconUrl: string | null;
}

export interface ActivityItem {
  id: number;
  guildId: string;
  action: string;
  userId: string | null;
  userTag: string | null;
  details: string | null;
  createdAt: string;
}

export interface GuildOverview {
  id: string;
  name: string;
  iconUrl: string | null;
  memberCount: number;
  channelCount: number;
  roleCount: number;
  openTickets: number;
  botStatus: 'online' | 'offline';
  botTag: string | null;
  config: {
    ticketsEnabled: boolean;
    updatedAt: string;
  };
  recentActivity: ActivityItem[];
}
