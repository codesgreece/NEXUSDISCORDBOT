import {
  CategoryChannel,
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
import { getStaffRoles } from '../utils/discord';
import {
  DISCORD_BOTS_CATEGORY_NAME,
  DISCORD_SERVERS_CATEGORY_NAME,
} from '../config/serverStructure';

export { DISCORD_BOTS_CATEGORY_NAME, DISCORD_SERVERS_CATEGORY_NAME };

function getSortedCategories(guild: Guild): CategoryChannel[] {
  return [...guild.channels.cache.values()]
    .filter((c): c is CategoryChannel => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position);
}

function findGuildCategoryByName(guild: Guild, name: string): CategoryChannel | undefined {
  return getSortedCategories(guild).find((c) => c.name === name);
}

function isCategoryDirectlyBelow(
  guild: Guild,
  aboveCategoryId: string,
  belowCategoryId: string,
): boolean {
  const categories = getSortedCategories(guild);
  const aboveIndex = categories.findIndex((c) => c.id === aboveCategoryId);
  const belowIndex = categories.findIndex((c) => c.id === belowCategoryId);
  return aboveIndex >= 0 && belowIndex === aboveIndex + 1;
}

/** Place `category` immediately below `botsCategory` in the category list. */
async function placeCategoryBelowBots(
  guild: Guild,
  category: CategoryChannel,
  botsCategory: CategoryChannel,
  reason: string,
): Promise<void> {
  const others = getSortedCategories(guild).filter((c) => c.id !== category.id);
  const botsIndex = others.findIndex((c) => c.id === botsCategory.id);
  if (botsIndex < 0) return;

  const nextCategory = others[botsIndex + 1];
  if (nextCategory) {
    // Insert before the next category → becomes immediately below bots
    await category.setPosition(nextCategory.position, { reason });
  } else {
    // Bots is the last category — move just after it
    await category.setPosition(botsCategory.position + 1, { reason });
  }
}

function assertValidDiscordServersCategory(
  channel: { id?: string | null; type: ChannelType; guildId: string | null; name: string },
  guildId: string,
): void {
  if (!channel.id) {
    throw new Error('Discord returned a category without an id');
  }
  if (channel.type !== ChannelType.GuildCategory) {
    throw new Error(
      `Discord returned type ${channel.type}, expected GuildCategory (${ChannelType.GuildCategory})`,
    );
  }
  if (channel.guildId !== guildId) {
    throw new Error(`Category guild mismatch: ${channel.guildId} !== ${guildId}`);
  }
  if (channel.name !== DISCORD_SERVERS_CATEGORY_NAME) {
    throw new Error(
      `Category name mismatch: got "${channel.name}", expected "${DISCORD_SERVERS_CATEGORY_NAME}"`,
    );
  }
}

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
 * Success is returned only after Discord confirms the category exists.
 */
export async function createDiscordServersCategory(
  guildId: string,
  actor?: { id: string; tag: string },
): Promise<{
  created: boolean;
  id: string;
  name: string;
  position: number;
  message: string;
}> {
  const guild = getClient().guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');

  // 1) Fetch existing guild channels once
  console.log('[DISCORD SERVERS] Creating category...');
  console.log(`[DISCORD SERVERS] Guild ID: ${guild.id}`);
  await guild.channels.fetch();

  const botsCategory = findGuildCategoryByName(guild, DISCORD_BOTS_CATEGORY_NAME);
  const existing = findGuildCategoryByName(guild, DISCORD_SERVERS_CATEGORY_NAME);

  // 2) Already exists → do not duplicate / do not reset permissions
  if (existing) {
    assertValidDiscordServersCategory(existing, guild.id);
    const positionBefore = existing.position;
    console.log(`[DISCORD SERVERS] Already exists ID: ${existing.id}`);
    console.log(`[DISCORD SERVERS] Position before: ${positionBefore}`);

    if (
      botsCategory &&
      !isCategoryDirectlyBelow(guild, botsCategory.id, existing.id)
    ) {
      await placeCategoryBelowBots(
        guild,
        existing,
        botsCategory,
        `Enforce ${DISCORD_SERVERS_CATEGORY_NAME} below ${DISCORD_BOTS_CATEGORY_NAME}`,
      );
    }

    await guild.channels.fetch();
    const verifiedExisting = await guild.channels.fetch(existing.id);
    if (!verifiedExisting) {
      console.log('[DISCORD SERVERS] Verification: FAILED');
      throw new Error(
        `Category ${existing.id} could not be re-fetched from Discord after existence check`,
      );
    }
    assertValidDiscordServersCategory(verifiedExisting, guild.id);

    const positionAfter =
      'position' in verifiedExisting ? verifiedExisting.position : positionBefore;
    console.log(`[DISCORD SERVERS] Position after: ${positionAfter}`);
    console.log('[DISCORD SERVERS] Verification: SUCCESS');

    const placementOk =
      !botsCategory || isCategoryDirectlyBelow(guild, botsCategory.id, verifiedExisting.id);
    return {
      created: false,
      id: verifiedExisting.id,
      name: verifiedExisting.name,
      position: positionAfter,
      message: [
        `ℹ️ Category **${verifiedExisting.name}** already exists`,
        `(id \`${verifiedExisting.id}\`, <#${verifiedExisting.id}>).`,
        `Position: **${positionAfter}**.`,
        botsCategory
          ? placementOk
            ? `Confirmed directly below **${DISCORD_BOTS_CATEGORY_NAME}**.`
            : `⚠️ Could not confirm placement directly below **${DISCORD_BOTS_CATEGORY_NAME}**.`
          : `⚠️ **${DISCORD_BOTS_CATEGORY_NAME}** not found — placement not enforced.`,
        'Permissions were not modified.',
      ].join(' '),
    };
  }

  // 3) Create immediately via Discord API
  const category = await guild.channels.create({
    name: DISCORD_SERVERS_CATEGORY_NAME,
    type: ChannelType.GuildCategory,
    permissionOverwrites: buildDiscordServersCategoryOverwrites(guild),
    reason: `Manual Control Center create by ${actor?.tag ?? 'unknown'}`,
  });

  assertValidDiscordServersCategory(category, guild.id);
  console.log(`[DISCORD SERVERS] Created category ID: ${category.id}`);
  const positionBefore = category.position;
  console.log(`[DISCORD SERVERS] Position before: ${positionBefore}`);

  // 4) Set position immediately below 🤖 DISCORD BOTS via Discord position API
  if (botsCategory) {
    const botsFresh =
      (guild.channels.cache.get(botsCategory.id) as CategoryChannel | undefined) ?? botsCategory;
    await placeCategoryBelowBots(
      guild,
      category,
      botsFresh,
      `Place ${DISCORD_SERVERS_CATEGORY_NAME} below ${DISCORD_BOTS_CATEGORY_NAME}`,
    );
  }

  // 5) Verify with one refresh/fetch
  await guild.channels.fetch();
  const verified = await guild.channels.fetch(category.id);
  if (!verified) {
    console.log('[DISCORD SERVERS] Verification: FAILED');
    throw new Error(
      `Discord create returned id ${category.id}, but the category was not found on refresh`,
    );
  }

  try {
    assertValidDiscordServersCategory(verified, guild.id);
  } catch (error) {
    console.log('[DISCORD SERVERS] Verification: FAILED');
    throw error;
  }

  const positionAfter = 'position' in verified ? verified.position : category.position;
  console.log(`[DISCORD SERVERS] Position after: ${positionAfter}`);

  const placementOk =
    !botsCategory || isCategoryDirectlyBelow(guild, botsCategory.id, verified.id);
  if (botsCategory && !placementOk) {
    console.log('[DISCORD SERVERS] Verification: FAILED');
    throw new Error(
      `Category was created (id ${verified.id}) but is not positioned directly below ${DISCORD_BOTS_CATEGORY_NAME}`,
    );
  }

  console.log('[DISCORD SERVERS] Verification: SUCCESS');

  return {
    created: true,
    id: verified.id,
    name: verified.name,
    position: positionAfter,
    message: [
      `✅ Verified category **${verified.name}**`,
      `(id \`${verified.id}\`, <#${verified.id}>, position **${positionAfter}**).`,
      botsCategory
        ? `Placed directly below **${DISCORD_BOTS_CATEGORY_NAME}**.`
        : `⚠️ **${DISCORD_BOTS_CATEGORY_NAME}** was not found — created without relative placement.`,
      'No channels were created inside it.',
    ].join(' '),
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
