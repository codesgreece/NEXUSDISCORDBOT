import { getClient } from '../bot/client';
import { recordActivity } from '../db/activityRepository';

export function listRoles(guildId: string) {
  const guild = getClient().guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');

  return guild.roles.cache
    .filter((r) => r.id !== guild.id)
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.hexColor,
      position: r.position,
      hoist: r.hoist,
      mentionable: r.mentionable,
      managed: r.managed,
      members: r.members.size,
      permissions: r.permissions.bitfield.toString(),
    }))
    .sort((a, b) => b.position - a.position);
}

export async function createRole(
  guildId: string,
  input: { name: string; color?: string; hoist?: boolean; mentionable?: boolean },
  actor?: { id: string; tag: string },
) {
  const guild = getClient().guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');

  const role = await guild.roles.create({
    name: input.name.slice(0, 100),
    color: (input.color as import("discord.js").ColorResolvable | undefined) || undefined,
    hoist: Boolean(input.hoist),
    mentionable: Boolean(input.mentionable),
    reason: `Dashboard create by ${actor?.tag ?? 'unknown'}`,
  });

  recordActivity({
    guildId,
    action: 'Role created',
    userId: actor?.id,
    userTag: actor?.tag,
    details: `Created @${role.name}`,
  });

  return { id: role.id, name: role.name, color: role.hexColor };
}

export async function updateRole(
  guildId: string,
  roleId: string,
  input: { name?: string; color?: string; hoist?: boolean; mentionable?: boolean },
  actor?: { id: string; tag: string },
) {
  const guild = getClient().guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');
  const role = guild.roles.cache.get(roleId);
  if (!role) throw new Error('Role not found');
  if (role.managed) throw new Error('Cannot edit managed (bot/integration) roles');

  await role.edit({
    name: input.name?.slice(0, 100),
    color: input.color as import('discord.js').ColorResolvable | undefined,
    hoist: input.hoist,
    mentionable: input.mentionable,
    reason: `Dashboard update by ${actor?.tag ?? 'unknown'}`,
  });

  recordActivity({
    guildId,
    action: 'Role updated',
    userId: actor?.id,
    userTag: actor?.tag,
    details: `Updated @${role.name}`,
  });

  return { id: role.id, name: role.name, color: role.hexColor };
}

export async function deleteRole(
  guildId: string,
  roleId: string,
  actor?: { id: string; tag: string },
) {
  const guild = getClient().guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');
  const role = guild.roles.cache.get(roleId);
  if (!role) throw new Error('Role not found');
  if (role.managed) throw new Error('Cannot delete managed (bot/integration) roles');
  const name = role.name;
  await role.delete(`Dashboard delete by ${actor?.tag ?? 'unknown'}`);

  recordActivity({
    guildId,
    action: 'Role deleted',
    userId: actor?.id,
    userTag: actor?.tag,
    details: `Deleted @${name}`,
  });

  return { ok: true };
}
