import {
  CategoryChannel,
  ChannelType,
  Guild,
  GuildChannel,
  OverwriteResolvable,
  PermissionFlagsBits,
  Role,
  TextChannel,
} from 'discord.js';
import { STAFF_ROLE_NAMES } from '../config/serverStructure';

export function findRoleByName(guild: Guild, name: string): Role | undefined {
  return guild.roles.cache.find((role) => role.name === name);
}

export function findChannelByName(
  guild: Guild,
  name: string,
  parentId?: string | null,
): GuildChannel | undefined {
  return guild.channels.cache.find((channel) => {
    if (channel.name !== name) return false;
    if (parentId !== undefined) {
      return 'parentId' in channel && channel.parentId === parentId;
    }
    return true;
  }) as GuildChannel | undefined;
}

export function findCategoryByName(guild: Guild, name: string): CategoryChannel | undefined {
  const channel = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === name,
  );
  return channel as CategoryChannel | undefined;
}

export function findTextChannelByName(guild: Guild, name: string): TextChannel | undefined {
  const channel = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name === name,
  );
  return channel as TextChannel | undefined;
}

export function getStaffRoles(guild: Guild): Role[] {
  return STAFF_ROLE_NAMES.map((name) => findRoleByName(guild, name)).filter(
    (role): role is Role => role !== undefined,
  );
}

export function buildStaffOverwrites(
  guild: Guild,
  staffRoles: Role[],
): OverwriteResolvable[] {
  const overwrites: OverwriteResolvable[] = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
  ];

  for (const role of staffRoles) {
    overwrites.push({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    });
  }

  return overwrites;
}

export function sanitizeUsername(username: string): string {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 20) || 'user';
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
