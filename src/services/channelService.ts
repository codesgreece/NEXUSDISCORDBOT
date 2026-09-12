import {
  ChannelType,
  GuildChannel,
  OverwriteResolvable,
  PermissionFlagsBits,
} from 'discord.js';
import { getClient } from '../bot/client';
import { recordActivity } from '../db/activityRepository';

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
    await channel.setTopic(input.topic);
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
