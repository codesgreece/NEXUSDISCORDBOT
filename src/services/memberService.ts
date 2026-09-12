import { getClient } from '../bot/client';
import { recordActivity } from '../db/activityRepository';

export async function listMembers(guildId: string, query?: string) {
  const guild = getClient().guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');

  // Prefer cache; fetch if empty/small
  if (guild.members.cache.size < Math.min(guild.memberCount || 0, 50)) {
    await guild.members.fetch().catch(() => undefined);
  }

  const q = (query || '').trim().toLowerCase();
  let members = [...guild.members.cache.values()];
  if (q) {
    members = members.filter(
      (m) =>
        m.user.username.toLowerCase().includes(q) ||
        (m.displayName || '').toLowerCase().includes(q) ||
        m.id.includes(q),
    );
  }

  return members
    .slice(0, 200)
    .map((m) => ({
      id: m.id,
      username: m.user.username,
      displayName: m.displayName,
      avatarUrl: m.user.displayAvatarURL({ size: 64 }),
      bot: m.user.bot,
      joinedAt: m.joinedAt?.toISOString() ?? null,
      roles: m.roles.cache
        .filter((r) => r.id !== guild.id)
        .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }))
        .sort((a, b) => b.name.localeCompare(a.name)),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function timeoutMember(
  guildId: string,
  userId: string,
  minutes: number,
  actor?: { id: string; tag: string },
) {
  const guild = getClient().guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');
  const member = await guild.members.fetch(userId);
  if (!member) throw new Error('Member not found');
  if (minutes <= 0) {
    await member.timeout(null, `Dashboard unmute by ${actor?.tag ?? 'unknown'}`);
  } else {
    await member.timeout(
      Math.min(minutes, 60 * 24 * 28) * 60 * 1000,
      `Dashboard timeout by ${actor?.tag ?? 'unknown'}`,
    );
  }

  recordActivity({
    guildId,
    action: minutes > 0 ? 'Member timed out' : 'Member timeout cleared',
    userId: actor?.id,
    userTag: actor?.tag,
    details: `${member.user.tag} · ${minutes > 0 ? `${minutes}m` : 'cleared'}`,
  });

  return { ok: true };
}

export async function kickMember(
  guildId: string,
  userId: string,
  actor?: { id: string; tag: string },
) {
  const guild = getClient().guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');
  const member = await guild.members.fetch(userId);
  const tag = member.user.tag;
  await member.kick(`Dashboard kick by ${actor?.tag ?? 'unknown'}`);

  recordActivity({
    guildId,
    action: 'Member kicked',
    userId: actor?.id,
    userTag: actor?.tag,
    details: tag,
  });

  return { ok: true };
}
