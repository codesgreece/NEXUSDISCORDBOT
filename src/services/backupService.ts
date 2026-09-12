import { ChannelType, Guild } from 'discord.js';
import {
  createBackup,
  getAutomodSettings,
  getBackup,
  getRoleBindings,
  getSecuritySettings,
  getWelcomeSettings,
  setAutomodSettings,
  setRoleBindings,
  setSecuritySettings,
  setWelcomeSettings,
  type AutomodSettings,
  type RoleBindings,
  type SecuritySettings,
  type WelcomeSettings,
} from '../db/controlRepository';
import { getGuildConfig, updateGuildConfig, type GuildConfig } from '../db/guildConfigRepository';
import { listCategories } from '../db/shopCategoryRepository';
import { listProducts } from '../db/shopProductRepository';
import { logEvent } from './loggingService';
import { BRAND } from '../config/serverStructure';

export interface BackupRoleSnapshot {
  id: string;
  name: string;
  color: number;
  permissions: string;
}

export interface BackupChannelSnapshot {
  id: string;
  name: string;
  type: number;
  parentId: string | null;
  topic: string | null;
}

export interface GuildBackupPayload {
  version: 1;
  createdAt: string;
  roles: BackupRoleSnapshot[];
  channels: BackupChannelSnapshot[];
  guildConfig: GuildConfig;
  roleBindings: RoleBindings;
  welcome: WelcomeSettings;
  automod: AutomodSettings;
  security: SecuritySettings;
  shop: {
    categories: number;
    products: number;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asGuildConfigPatch(raw: unknown): Partial<{
  ticketsEnabled: boolean;
  ticketCategoryId: string | null;
  logChannelId: string | null;
  staffRoleIds: string[];
  ticketTypes: unknown[];
  welcomeMessageId: string | null;
  rulesMessageId: string | null;
  servicesMessageId: string | null;
  pricingMessageId: string | null;
  ticketPanelMessageId: string | null;
}> | null {
  if (!isRecord(raw)) return null;
  return {
    ticketsEnabled: typeof raw.ticketsEnabled === 'boolean' ? raw.ticketsEnabled : undefined,
    ticketCategoryId:
      raw.ticketCategoryId === null || typeof raw.ticketCategoryId === 'string'
        ? (raw.ticketCategoryId as string | null)
        : undefined,
    logChannelId:
      raw.logChannelId === null || typeof raw.logChannelId === 'string'
        ? (raw.logChannelId as string | null)
        : undefined,
    staffRoleIds: Array.isArray(raw.staffRoleIds)
      ? raw.staffRoleIds.filter((id): id is string => typeof id === 'string')
      : undefined,
    ticketTypes: Array.isArray(raw.ticketTypes) ? raw.ticketTypes : undefined,
    welcomeMessageId:
      raw.welcomeMessageId === null || typeof raw.welcomeMessageId === 'string'
        ? (raw.welcomeMessageId as string | null)
        : undefined,
    rulesMessageId:
      raw.rulesMessageId === null || typeof raw.rulesMessageId === 'string'
        ? (raw.rulesMessageId as string | null)
        : undefined,
    servicesMessageId:
      raw.servicesMessageId === null || typeof raw.servicesMessageId === 'string'
        ? (raw.servicesMessageId as string | null)
        : undefined,
    pricingMessageId:
      raw.pricingMessageId === null || typeof raw.pricingMessageId === 'string'
        ? (raw.pricingMessageId as string | null)
        : undefined,
    ticketPanelMessageId:
      raw.ticketPanelMessageId === null || typeof raw.ticketPanelMessageId === 'string'
        ? (raw.ticketPanelMessageId as string | null)
        : undefined,
  };
}

export async function createGuildBackup(guild: Guild, label: string): Promise<string> {
  const roles: BackupRoleSnapshot[] = guild.roles.cache
    .filter((r) => r.id !== guild.id)
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      permissions: r.permissions.bitfield.toString(),
    }));

  const channels: BackupChannelSnapshot[] = guild.channels.cache.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    parentId: 'parentId' in c ? c.parentId : null,
    topic:
      c.type === ChannelType.GuildText && 'topic' in c
        ? (c.topic as string | null)
        : null,
  }));

  const payload: GuildBackupPayload = {
    version: 1,
    createdAt: new Date().toISOString(),
    roles,
    channels,
    guildConfig: getGuildConfig(guild.id),
    roleBindings: getRoleBindings(guild.id),
    welcome: getWelcomeSettings(guild.id),
    automod: getAutomodSettings(guild.id),
    security: getSecuritySettings(guild.id),
    shop: {
      categories: listCategories().length,
      products: listProducts().length,
    },
  };

  const id = createBackup(guild.id, label, payload);

  await logEvent(guild, {
    title: 'BACKUP · Created',
    description: `Δημιουργήθηκε backup **${label}** (\`${id.slice(0, 8)}\`)`,
    color: BRAND.success,
    fields: [
      { name: 'Roles', value: String(roles.length), inline: true },
      { name: 'Channels', value: String(channels.length), inline: true },
      { name: 'Products', value: String(payload.shop.products), inline: true },
    ],
  });

  return id;
}

export async function restoreGuildBackup(guild: Guild, backupId: string): Promise<string> {
  const backup = getBackup(backupId);
  if (!backup) {
    return '❌ Το backup δεν βρέθηκε.';
  }
  if (backup.guildId !== guild.id) {
    return '❌ Το backup ανήκει σε άλλο server — απορρίφθηκε.';
  }

  const payload = isRecord(backup.payload) ? backup.payload : {};

  const configPatch = asGuildConfigPatch(payload.guildConfig);
  if (configPatch) {
    updateGuildConfig(guild.id, configPatch);
  }

  if (isRecord(payload.roleBindings)) {
    setRoleBindings(guild.id, payload.roleBindings as Partial<RoleBindings>);
  }
  if (isRecord(payload.welcome)) {
    setWelcomeSettings(guild.id, payload.welcome as Partial<WelcomeSettings>);
  }
  if (isRecord(payload.automod)) {
    setAutomodSettings(guild.id, payload.automod as unknown as AutomodSettings);
  }
  if (isRecord(payload.security)) {
    setSecuritySettings(guild.id, payload.security as Partial<SecuritySettings>);
  }

  await logEvent(guild, {
    title: 'BACKUP · Restored',
    description:
      `Έγινε restore ρυθμίσεων από backup \`${backupId.slice(0, 8)}\`.\n` +
      `Channels/roles **δεν** αναδημιουργήθηκαν (μη-καταστροφικό restore).`,
    color: BRAND.warning,
  });

  return (
    `✅ Restore ολοκληρώθηκε για \`${backupId.slice(0, 8)}\`.\n` +
    `Επαναφέρθηκαν: guild_config, role bindings, welcome, automod, security.\n` +
    `Δεν έγιναν destructive αλλαγές σε channels/roles.`
  );
}
