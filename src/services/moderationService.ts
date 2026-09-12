import { Guild, GuildMember } from 'discord.js';
import { BRAND } from '../config/serverStructure';
import { createModerationCase } from '../db/controlRepository';
import { logEvent } from './loggingService';

function greekError(message: string): Error {
  return new Error(message);
}

async function resolveMember(guild: Guild, userId: string): Promise<GuildMember> {
  try {
    return await guild.members.fetch(userId);
  } catch {
    throw greekError('Το μέλος δεν βρέθηκε στον server.');
  }
}

export async function warnMember(
  guild: Guild,
  userId: string,
  moderatorId: string,
  reason = '—',
): Promise<void> {
  const member = await resolveMember(guild, userId).catch(() => null);
  const tag = member?.user.tag ?? userId;

  createModerationCase({
    guildId: guild.id,
    userId,
    moderatorId,
    type: 'warn',
    reason,
  });

  await logEvent(guild, {
    title: 'MODERATION · Warn',
    description: `Προειδοποίηση σε **${tag}** (<@${userId}>)\nΛόγος: ${reason}`,
    color: BRAND.warning,
    actorId: moderatorId,
    fields: [
      { name: 'User', value: `<@${userId}>`, inline: true },
      { name: 'Moderator', value: `<@${moderatorId}>`, inline: true },
    ],
  });
}

export async function banMember(
  guild: Guild,
  userId: string,
  moderatorId: string,
  reason = '—',
  deleteMessageSeconds = 0,
): Promise<void> {
  try {
    await guild.members.ban(userId, {
      reason: reason.slice(0, 512),
      deleteMessageSeconds: Math.min(Math.max(deleteMessageSeconds, 0), 604800),
    });
  } catch {
    throw greekError('Αποτυχία ban. Έλεγξε δικαιώματα και ιεραρχία ρόλων.');
  }

  createModerationCase({
    guildId: guild.id,
    userId,
    moderatorId,
    type: 'ban',
    reason,
  });

  await logEvent(guild, {
    title: 'MODERATION · Ban',
    description: `Ban σε <@${userId}>\nΛόγος: ${reason}`,
    color: BRAND.danger,
    actorId: moderatorId,
    fields: [
      { name: 'User', value: `<@${userId}>`, inline: true },
      { name: 'Moderator', value: `<@${moderatorId}>`, inline: true },
    ],
  });
}

export async function unbanMember(
  guild: Guild,
  userId: string,
  moderatorId: string,
  reason = '—',
): Promise<void> {
  try {
    await guild.members.unban(userId, reason.slice(0, 512));
  } catch {
    throw greekError('Αποτυχία unban. Ο χρήστης μπορεί να μην είναι banned.');
  }

  createModerationCase({
    guildId: guild.id,
    userId,
    moderatorId,
    type: 'unban',
    reason,
  });

  await logEvent(guild, {
    title: 'MODERATION · Unban',
    description: `Unban σε <@${userId}>\nΛόγος: ${reason}`,
    color: BRAND.success,
    actorId: moderatorId,
    fields: [
      { name: 'User', value: `<@${userId}>`, inline: true },
      { name: 'Moderator', value: `<@${moderatorId}>`, inline: true },
    ],
  });
}

export async function nicknameMember(
  guild: Guild,
  userId: string,
  nickname: string | null,
  moderatorId: string,
): Promise<void> {
  const member = await resolveMember(guild, userId);
  try {
    await member.setNickname(nickname, `Nickname by ${moderatorId}`);
  } catch {
    throw greekError('Αποτυχία αλλαγής nickname. Έλεγξε δικαιώματα και ιεραρχία.');
  }

  createModerationCase({
    guildId: guild.id,
    userId,
    moderatorId,
    type: 'nickname',
    reason: nickname ?? '(cleared)',
  });

  await logEvent(guild, {
    title: 'MODERATION · Nickname',
    description: `Nickname για <@${userId}>: **${nickname ?? '(cleared)'}**`,
    color: BRAND.accent,
    actorId: moderatorId,
  });
}

export async function addRolesToMember(
  guild: Guild,
  userId: string,
  roleIds: string[],
  moderatorId: string,
): Promise<void> {
  const member = await resolveMember(guild, userId);
  const unique = [...new Set(roleIds.filter((id) => id && id !== guild.id))];
  if (!unique.length) throw greekError('Δεν δόθηκαν roles για προσθήκη.');

  try {
    await member.roles.add(unique, `Roles add by ${moderatorId}`);
  } catch {
    throw greekError('Αποτυχία προσθήκης roles. Έλεγξε δικαιώματα και ιεραρχία.');
  }

  createModerationCase({
    guildId: guild.id,
    userId,
    moderatorId,
    type: 'roles_add',
    reason: unique.join(', '),
  });

  await logEvent(guild, {
    title: 'MODERATION · Roles Added',
    description: `Προστέθηκαν roles σε <@${userId}>: ${unique.map((id) => `<@&${id}>`).join(', ')}`,
    color: BRAND.success,
    actorId: moderatorId,
  });
}

export async function removeRolesFromMember(
  guild: Guild,
  userId: string,
  roleIds: string[],
  moderatorId: string,
): Promise<void> {
  const member = await resolveMember(guild, userId);
  const unique = [...new Set(roleIds.filter((id) => id && id !== guild.id))];
  if (!unique.length) throw greekError('Δεν δόθηκαν roles για αφαίρεση.');

  try {
    await member.roles.remove(unique, `Roles remove by ${moderatorId}`);
  } catch {
    throw greekError('Αποτυχία αφαίρεσης roles. Έλεγξε δικαιώματα και ιεραρχία.');
  }

  createModerationCase({
    guildId: guild.id,
    userId,
    moderatorId,
    type: 'roles_remove',
    reason: unique.join(', '),
  });

  await logEvent(guild, {
    title: 'MODERATION · Roles Removed',
    description: `Αφαιρέθηκαν roles από <@${userId}>: ${unique.map((id) => `<@&${id}>`).join(', ')}`,
    color: BRAND.warning,
    actorId: moderatorId,
  });
}

/** Add selected roles to the member (used by Control Center role select). */
export async function setMemberRoles(
  guild: Guild,
  userId: string,
  roleIds: string[],
  moderatorId: string,
): Promise<void> {
  await addRolesToMember(guild, userId, roleIds, moderatorId);
}

export async function purgeChannelMessages(
  guild: Guild,
  channelId: string,
  amount: number,
  moderatorId: string,
): Promise<number> {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    throw greekError('Το κανάλι δεν βρέθηκε ή δεν υποστηρίζει purge.');
  }

  const limit = Math.min(100, Math.max(1, Math.floor(amount)));
  let deletedCount = 0;
  try {
    const deleted = await channel.bulkDelete(limit, true);
    deletedCount = deleted.size;
  } catch {
    throw greekError('Αποτυχία purge. Μηνύματα >14 ημερών δεν διαγράφονται μαζικά.');
  }

  createModerationCase({
    guildId: guild.id,
    userId: moderatorId,
    moderatorId,
    type: 'purge',
    reason: `${deletedCount} messages in #${channel.name}`,
  });

  await logEvent(guild, {
    title: 'MODERATION · Purge',
    description: `<@${moderatorId}> διέγραψε **${deletedCount}** μηνύματα σε <#${channelId}>`,
    color: BRAND.warning,
    actorId: moderatorId,
  });

  return deletedCount;
}

export async function timeoutMemberModeration(
  guild: Guild,
  userId: string,
  moderatorId: string,
  minutes: number,
  reason = '—',
): Promise<void> {
  const member = await resolveMember(guild, userId);
  const ms = Math.min(Math.max(minutes, 1), 60 * 24 * 28) * 60 * 1000;
  try {
    await member.timeout(ms, reason.slice(0, 512));
  } catch {
    throw greekError('Αποτυχία timeout. Έλεγξε δικαιώματα και ιεραρχία.');
  }

  createModerationCase({
    guildId: guild.id,
    userId,
    moderatorId,
    type: 'timeout',
    reason,
    durationMinutes: minutes,
  });

  await logEvent(guild, {
    title: 'MODERATION · Timeout',
    description: `Timeout **${minutes}m** σε <@${userId}>\nΛόγος: ${reason}`,
    color: BRAND.warning,
    actorId: moderatorId,
  });
}
