import {
  ChannelType,
  Guild,
  GuildChannel,
  OverwriteResolvable,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { getClient } from '../bot/client';
import { recordActivity } from '../db/activityRepository';
import { getRoleBindings } from '../db/controlRepository';
import { findCategoryByName, getStaffRoles } from '../utils/discord';
import {
  DISCORD_BOTS_CATEGORY_NAME,
  DISCORD_SERVERS_CATEGORY_NAME,
} from '../config/serverStructure';

export { DISCORD_BOTS_CATEGORY_NAME, DISCORD_SERVERS_CATEGORY_NAME };

export function listChannels(guildId: string) {
  const guild = getClient().guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');

  const categories = guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildCategory)
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: 'category' as const,
      position: c.rawPosition,
    }))
    .sort((a, b) => a.position - b.position);

  const text = guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildText)
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: 'text' as const,
      parentId: c.parentId,
      topic: 'topic' in c ? c.topic : null,
      position: c.rawPosition,
    }))
    .sort((a, b) => a.position - b.position);

  const voice = guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildVoice)
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: 'voice' as const,
      parentId: c.parentId,
      position: c.rawPosition,
    }))
    .sort((a, b) => a.position - b.position);

  return { categories, text, voice };
}

export async function createChannel(
  guildId: string,
  input: {
    name: string;
    type: 'text' | 'voice' | 'category';
    parentId?: string | null;
    topic?: string;
  },
  actor?: { id: string; tag: string },
) {
  const guild = getClient().guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');

  const type =
    input.type === 'category'
      ? ChannelType.GuildCategory
      : input.type === 'voice'
        ? ChannelType.GuildVoice
        : ChannelType.GuildText;

  const channel = await guild.channels.create({
    name: input.name.slice(0, 100),
    type,
    parent: input.type === 'category' ? undefined : input.parentId || undefined,
    topic: input.type === 'text' ? input.topic : undefined,
    reason: `Dashboard create by ${actor?.tag ?? 'unknown'}`,
  });

  recordActivity({
    guildId,
    action: 'Channel created',
    userId: actor?.id,
    userTag: actor?.tag,
    details: `Created #${channel.name}`,
  });

  return { id: channel.id, name: channel.name, type: input.type };
}

function buildDiscordServersCategoryOverwrites(guild: Guild): OverwriteResolvable[] {
  const everyoneAllow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
  ];

  const staffAllow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ManageChannels,
  ];

  const botAllow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ManageChannels,
  ];

  const overwrites: OverwriteResolvable[] = [
    {
      id: guild.id,
      allow: everyoneAllow,
    },
  ];

  const staffRoleIds = new Set<string>();
  for (const role of getStaffRoles(guild)) {
    staffRoleIds.add(role.id);
  }

  const bindings = getRoleBindings(guild.id);
  for (const id of [bindings.adminRoleId, bindings.staffRoleId, bindings.moderatorRoleId]) {
    if (id && guild.roles.cache.has(id)) staffRoleIds.add(id);
  }

  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.id) continue;
    if (role.permissions.has(PermissionFlagsBits.Administrator)) {
      staffRoleIds.add(role.id);
    }
  }

  for (const roleId of staffRoleIds) {
    overwrites.push({ id: roleId, allow: staffAllow });
  }

  const me = guild.members.me;
  if (me) {
    overwrites.push({ id: me.id, allow: botAllow });
  }
  if (bindings.botRoleId && guild.roles.cache.has(bindings.botRoleId)) {
    overwrites.push({ id: bindings.botRoleId, allow: botAllow });
  }

  return overwrites;
}

/**
 * Explicit Control Center action: create **only** `🌐 DISCORD SERVERS`.
 * - No channels inside
 * - No other categories touched
 * - No duplicate if it already exists (permissions left unchanged)
 * - Positioned immediately below `🤖 DISCORD BOTS`
 */
export async function createDiscordServersCategory(
  guildId: string,
  actor?: { id: string; tag: string },
): Promise<{ created: boolean; id: string; name: string; message: string }> {
  const guild = getClient().guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');

  const existing = findCategoryByName(guild, DISCORD_SERVERS_CATEGORY_NAME);
  if (existing) {
    return {
      created: false,
      id: existing.id,
      name: existing.name,
      message: `ℹ️ Category **${DISCORD_SERVERS_CATEGORY_NAME}** already exists — no duplicate created and permissions were not reset.`,
    };
  }

  const botsCategory = findCategoryByName(guild, DISCORD_BOTS_CATEGORY_NAME);
  const overwrites = buildDiscordServersCategoryOverwrites(guild);

  const category = await guild.channels.create({
    name: DISCORD_SERVERS_CATEGORY_NAME,
    type: ChannelType.GuildCategory,
    permissionOverwrites: overwrites,
    reason: `Manual Control Center create by ${actor?.tag ?? 'unknown'}`,
  });

  if (botsCategory) {
    const childPositions: number[] = [];
    for (const c of guild.channels.cache.values()) {
      if (!('parentId' in c) || !('rawPosition' in c)) continue;
      if (c.parentId !== botsCategory.id) continue;
      childPositions.push((c as { rawPosition: number }).rawPosition);
    }
    const blockEnd = Math.max(
      botsCategory.rawPosition,
      ...(childPositions.length ? childPositions : [botsCategory.rawPosition]),
    );
    try {
      await category.setPosition(blockEnd + 1, {
        reason: `Place ${DISCORD_SERVERS_CATEGORY_NAME} below ${DISCORD_BOTS_CATEGORY_NAME}`,
      });
    } catch (error) {
      console.warn(
        `[CHANNELS] Created ${DISCORD_SERVERS_CATEGORY_NAME} but could not set position below ${DISCORD_BOTS_CATEGORY_NAME}:`,
        error,
      );
    }
  }

  recordActivity({
    guildId,
    action: 'Category created',
    userId: actor?.id,
    userTag: actor?.tag,
    details: `Created category ${category.name} (manual Discord Servers)`,
  });

  const positionNote = botsCategory
    ? `Positioned immediately below **${DISCORD_BOTS_CATEGORY_NAME}**.`
    : `⚠️ **${DISCORD_BOTS_CATEGORY_NAME}** was not found — category was created without relative placement.`;

  return {
    created: true,
    id: category.id,
    name: category.name,
    message: `✅ Created **${category.name}** (no channels). ${positionNote}`,
  };
}

export async function updateChannel(
  guildId: string,
  channelId: string,
  input: {
    name?: string;
    topic?: string | null;
    parentId?: string | null;
    position?: number;
  },
  actor?: { id: string; tag: string },
) {
  const guild = getClient().guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');
  const channel = guild.channels.cache.get(channelId) as GuildChannel | undefined;
  if (!channel) throw new Error('Channel not found');

  if (input.name && input.name !== channel.name) {
    await channel.setName(input.name.slice(0, 100));
  }
  if (input.parentId !== undefined && 'setParent' in channel) {
    await channel.setParent(input.parentId, { lockPermissions: false });
  }
  if (input.position !== undefined) {
    await channel.setPosition(input.position);
  }
  if (input.topic !== undefined && channel.type === ChannelType.GuildText) {
    await (channel as TextChannel).setTopic(input.topic);
  }

  recordActivity({
    guildId,
    action: 'Channel updated',
    userId: actor?.id,
    userTag: actor?.tag,
    details: `Updated #${channel.name}`,
  });

  return { id: channel.id, name: channel.name };
}

export async function deleteChannel(
  guildId: string,
  channelId: string,
  actor?: { id: string; tag: string },
) {
  const guild = getClient().guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');
  const channel = guild.channels.cache.get(channelId);
  if (!channel) throw new Error('Channel not found');
  const name = channel.name;
  await channel.delete(`Dashboard delete by ${actor?.tag ?? 'unknown'}`);

  recordActivity({
    guildId,
    action: 'Channel deleted',
    userId: actor?.id,
    userTag: actor?.tag,
    details: `Deleted #${name}`,
  });

  return { ok: true };
}

export async function setChannelPrivateStaff(
  guildId: string,
  channelId: string,
  staffRoleIds: string[],
) {
  const guild = getClient().guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');
  const channel = guild.channels.cache.get(channelId);
  if (!channel || !('permissionOverwrites' in channel)) throw new Error('Invalid channel');

  const overwrites: OverwriteResolvable[] = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    ...staffRoleIds.map((id) => ({
      id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    })),
  ];
  await channel.permissionOverwrites.set(overwrites);
}

export async function lockChannel(
  guildId: string,
  channelId: string,
  actor?: { id: string; tag: string },
) {
  const guild = getClient().guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');
  const channel = guild.channels.cache.get(channelId);
  if (!channel || !('permissionOverwrites' in channel)) throw new Error('Invalid channel');

  await channel.permissionOverwrites.edit(guild.id, { SendMessages: false });

  recordActivity({
    guildId,
    action: 'Channel locked',
    userId: actor?.id,
    userTag: actor?.tag,
    details: `#${channel.name}`,
  });

  return { ok: true };
}

export async function unlockChannel(
  guildId: string,
  channelId: string,
  actor?: { id: string; tag: string },
) {
  const guild = getClient().guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');
  const channel = guild.channels.cache.get(channelId);
  if (!channel || !('permissionOverwrites' in channel)) throw new Error('Invalid channel');

  await channel.permissionOverwrites.edit(guild.id, { SendMessages: null });

  recordActivity({
    guildId,
    action: 'Channel unlocked',
    userId: actor?.id,
    userTag: actor?.tag,
    details: `#${channel.name}`,
  });

  return { ok: true };
}

export async function setSlowmode(
  guildId: string,
  channelId: string,
  seconds: number,
  actor?: { id: string; tag: string },
) {
  const guild = getClient().guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');
  const channel = guild.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error('Slowmode only supported on text channels');
  }

  const rate = Math.min(21600, Math.max(0, Math.floor(seconds)));
  await (channel as TextChannel).setRateLimitPerUser(
    rate,
    `Dashboard slowmode by ${actor?.tag ?? 'unknown'}`,
  );

  recordActivity({
    guildId,
    action: 'Channel slowmode updated',
    userId: actor?.id,
    userTag: actor?.tag,
    details: `#${channel.name} · ${rate}s`,
  });

  return { ok: true, seconds: rate };
}
