import { ChannelType, Guild, PermissionFlagsBits } from 'discord.js';
import { getClient } from '../bot/client';
import { listActivity } from '../db/activityRepository';
import { getGuildConfig } from '../db/guildConfigRepository';

export interface DiscordUserGuild {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  permissions?: string | number;
}

export interface ManageableGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  botInGuild: boolean;
  canManage: boolean;
  iconUrl: string | null;
}

/** Short-lived cache to avoid Discord 429 on /users/@me/guilds */
const guildCache = new Map<string, { guilds: DiscordUserGuild[]; expiresAt: number }>();
const GUILD_CACHE_TTL_MS = 60_000;

function toPermsBigInt(permissions: string | number | bigint | undefined | null): bigint {
  if (permissions === undefined || permissions === null) return 0n;
  if (typeof permissions === 'bigint') return permissions;
  if (typeof permissions === 'number') return BigInt(Math.trunc(permissions));
  const trimmed = String(permissions).trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return 0n;
  return BigInt(trimmed);
}

export function userCanManageGuild(
  permissions: string | number | bigint | undefined | null,
  owner = false,
): boolean {
  if (owner) return true;
  try {
    const perms = toPermsBigInt(permissions);
    const admin = BigInt(PermissionFlagsBits.Administrator);
    const manageGuild = BigInt(PermissionFlagsBits.ManageGuild);
    return (perms & admin) === admin || (perms & manageGuild) === manageGuild;
  } catch {
    return false;
  }
}

export function clearGuildCache(): void {
  guildCache.clear();
}

export async function fetchUserGuilds(
  accessToken: string,
  options?: { force?: boolean },
): Promise<DiscordUserGuild[]> {
  const cacheKey = accessToken.slice(0, 24);
  const cached = guildCache.get(cacheKey);
  if (!options?.force && cached && cached.expiresAt > Date.now()) {
    return cached.guilds;
  }

  const response = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 429) {
    const retryAfterHeader = response.headers.get('retry-after');
    const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : 2;
    if (cached) {
      return cached.guilds;
    }
    await sleep(Math.min(Math.max(retryAfterSec, 1), 5) * 1000);
    const retry = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!retry.ok) {
      throw new Error(`Failed to fetch user guilds (${retry.status})`);
    }
    const guilds = (await retry.json()) as DiscordUserGuild[];
    guildCache.set(cacheKey, { guilds, expiresAt: Date.now() + GUILD_CACHE_TTL_MS });
    return guilds;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch user guilds (${response.status})`);
  }

  const guilds = (await response.json()) as DiscordUserGuild[];
  guildCache.set(cacheKey, { guilds, expiresAt: Date.now() + GUILD_CACHE_TTL_MS });
  return guilds;
}

async function memberCanManage(guildId: string, userId: string): Promise<boolean> {
  const client = getClient();
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return false;
  if (guild.ownerId === userId) return true;

  try {
    const member =
      guild.members.cache.get(userId) ??
      (await guild.members.fetch(userId).catch(() => null));
    if (!member) return false;
    return (
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      member.permissions.has(PermissionFlagsBits.ManageGuild)
    );
  } catch {
    return false;
  }
}

export async function assertGuildMembership(
  accessToken: string,
  guildId: string,
  userId: string,
): Promise<DiscordUserGuild> {
  const client = getClient();
  const botGuild = client.guilds.cache.get(guildId);
  if (!botGuild) {
    throw new GuildAccessError('This bot is not a member of that server.');
  }

  const guilds = await fetchUserGuilds(accessToken);
  const guild = guilds.find((g) => g.id === guildId);

  if (!guild) {
    // User might still be a member even if OAuth list is stale — try fetch
    const member = await botGuild.members.fetch(userId).catch(() => null);
    if (!member) {
      throw new GuildAccessError('You are not a member of this server.');
    }
  }

  return (
    guild ?? {
      id: guildId,
      name: botGuild.name,
      icon: botGuild.icon,
      owner: botGuild.ownerId === userId,
      permissions: '0',
    }
  );
}

/** Read access: user is in the guild and bot is present */
export async function assertGuildAccess(
  accessToken: string,
  guildId: string,
  userId: string,
): Promise<DiscordUserGuild> {
  return assertGuildMembership(accessToken, guildId, userId);
}

/** Write access: Administrator / Manage Guild / Owner */
export async function assertGuildManage(
  accessToken: string,
  guildId: string,
  userId: string,
): Promise<DiscordUserGuild> {
  const guild = await assertGuildMembership(accessToken, guildId, userId);

  const allowed =
    userCanManageGuild(guild.permissions, Boolean(guild.owner)) ||
    (await memberCanManage(guildId, userId));

  if (!allowed) {
    throw new GuildAccessError(
      'You need Administrator or Manage Server to change this server.',
    );
  }

  return guild;
}

export class GuildAccessError extends Error {
  status = 403;
  constructor(message: string) {
    super(message);
    this.name = 'GuildAccessError';
  }
}

export async function getManageableGuilds(
  userGuilds: DiscordUserGuild[],
  userId: string,
): Promise<ManageableGuild[]> {
  const client = getClient();
  const byId = new Map<string, ManageableGuild>();

  console.log(
    `[GUILDS] user=${userId} oauthGuilds=${JSON.stringify(
      userGuilds.map((g) => ({
        id: g.id,
        name: g.name,
        owner: g.owner,
        permissions: g.permissions,
      })),
    )} botGuilds=${JSON.stringify(
      [...client.guilds.cache.values()].map((g) => ({
        id: g.id,
        name: g.name,
        ownerId: g.ownerId,
      })),
    )}`,
  );

  for (const g of userGuilds) {
    const botGuild = client.guilds.cache.get(g.id);
    const oauthCanManage = userCanManageGuild(g.permissions, Boolean(g.owner));
    const botCanManage = botGuild ? await memberCanManage(g.id, userId) : false;
    const isOwner = Boolean(g.owner) || botGuild?.ownerId === userId;
    const canManage = isOwner || oauthCanManage || botCanManage;

    console.log(
      `[GUILDS] check ${g.name} (${g.id}): oauthCanManage=${oauthCanManage} botCanManage=${botCanManage} isOwner=${isOwner} botInGuild=${Boolean(botGuild)}`,
    );

    // Show guilds the user shares with the bot (or can manage elsewhere)
    if (!botGuild && !canManage) continue;

    byId.set(g.id, {
      id: g.id,
      name: g.name,
      icon: g.icon,
      owner: isOwner,
      permissions: String(g.permissions ?? '0'),
      botInGuild: Boolean(botGuild),
      canManage,
      iconUrl: g.icon
        ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`
        : botGuild?.iconURL({ size: 128 }) ?? null,
    });
  }

  // Bot guilds the user owns / can manage even if OAuth list missed them
  for (const guild of client.guilds.cache.values()) {
    if (byId.has(guild.id)) continue;
    const canManage = await memberCanManage(guild.id, userId);
    if (!canManage) continue;

    byId.set(guild.id, {
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      owner: guild.ownerId === userId,
      permissions: String(PermissionFlagsBits.Administrator),
      botInGuild: true,
      canManage: true,
      iconUrl: guild.iconURL({ size: 128 }),
    });
  }

  return [...byId.values()].sort((a, b) => {
    if (a.canManage !== b.canManage) return a.canManage ? -1 : 1;
    if (a.botInGuild !== b.botInGuild) return a.botInGuild ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function countOpenTickets(guild: Guild): number {
  return guild.channels.cache.filter((channel) => {
    if (channel.type !== ChannelType.GuildText) return false;
    return channel.name.startsWith('ticket-') && !channel.name.startsWith('closed-');
  }).size;
}

export function getGuildOverview(guildId: string) {
  const client = getClient();
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    throw new GuildAccessError('Guild not found in bot cache.');
  }

  const config = getGuildConfig(guildId);
  const activity = listActivity(guildId, 20);

  return {
    id: guild.id,
    name: guild.name,
    iconUrl: guild.iconURL({ size: 128 }),
    memberCount: guild.memberCount,
    channelCount: guild.channels.cache.filter((c) => c.type !== ChannelType.GuildCategory).size,
    roleCount: guild.roles.cache.size,
    openTickets: countOpenTickets(guild),
    botStatus: client.isReady() ? 'online' : 'offline',
    botTag: client.user?.tag ?? null,
    config: {
      ticketsEnabled: config.ticketsEnabled,
      updatedAt: config.updatedAt,
    },
    recentActivity: activity,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
