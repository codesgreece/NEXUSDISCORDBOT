import {
  GuildMember,
  PermissionFlagsBits,
  PermissionsBitField,
} from 'discord.js';
import { getRoleBindings } from '../db/controlRepository';
import { getGuildConfig } from '../db/guildConfigRepository';
import { getStaffRoles } from '../utils/discord';
import { isStaffOrAdmin } from './contentManagerService';

export type AccessLevel = 'admin' | 'staff' | 'moderator' | 'none';

export function getMemberAccessLevel(member: GuildMember): AccessLevel {
  if (member.permissions.has(PermissionFlagsBits.Administrator) || member.guild.ownerId === member.id) {
    return 'admin';
  }

  const bindings = getRoleBindings(member.guild.id);
  if (bindings.adminRoleId && member.roles.cache.has(bindings.adminRoleId)) return 'admin';

  const config = getGuildConfig(member.guild.id);
  if (config.staffRoleIds.some((id) => member.roles.cache.has(id))) return 'staff';
  if (bindings.staffRoleId && member.roles.cache.has(bindings.staffRoleId)) return 'staff';

  if (bindings.moderatorRoleId && member.roles.cache.has(bindings.moderatorRoleId)) {
    return 'moderator';
  }

  if (isStaffOrAdmin(member)) return 'staff';

  const staff = getStaffRoles(member.guild);
  if (staff.some((role) => member.roles.cache.has(role.id))) return 'staff';

  if (
    member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
    member.permissions.has(PermissionFlagsBits.KickMembers) ||
    member.permissions.has(PermissionFlagsBits.BanMembers) ||
    member.permissions.has(PermissionFlagsBits.ManageMessages)
  ) {
    return 'moderator';
  }

  return 'none';
}

export function requireStaff(member: GuildMember | null): boolean {
  if (!member) return false;
  const level = getMemberAccessLevel(member);
  return level === 'admin' || level === 'staff' || level === 'moderator';
}

export function requireAdmin(member: GuildMember | null): boolean {
  if (!member) return false;
  return getMemberAccessLevel(member) === 'admin';
}

export function memberHasPermission(
  member: GuildMember,
  permission: bigint | PermissionsBitField,
): boolean {
  if (getMemberAccessLevel(member) === 'admin') return true;
  return member.permissions.has(permission);
}
