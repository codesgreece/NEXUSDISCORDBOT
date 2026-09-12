import { getDb } from './index';

export interface GuildConfigRecord {
  guild_id: string;
  tickets_enabled: number;
  ticket_category_id: string | null;
  log_channel_id: string | null;
  staff_role_ids: string;
  ticket_types: string;
  welcome_message_id: string | null;
  rules_message_id: string | null;
  services_message_id: string | null;
  pricing_message_id: string | null;
  ticket_panel_message_id: string | null;
  updated_at: string;
}

export interface GuildConfig {
  guildId: string;
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
  updatedAt: string;
}

function mapRow(row: GuildConfigRecord): GuildConfig {
  return {
    guildId: row.guild_id,
    ticketsEnabled: Boolean(row.tickets_enabled),
    ticketCategoryId: row.ticket_category_id,
    logChannelId: row.log_channel_id,
    staffRoleIds: JSON.parse(row.staff_role_ids || '[]') as string[],
    ticketTypes: JSON.parse(row.ticket_types || '[]') as unknown[],
    welcomeMessageId: row.welcome_message_id,
    rulesMessageId: row.rules_message_id,
    servicesMessageId: row.services_message_id,
    pricingMessageId: row.pricing_message_id,
    ticketPanelMessageId: row.ticket_panel_message_id,
    updatedAt: row.updated_at,
  };
}

export function getGuildConfig(guildId: string): GuildConfig {
  const database = getDb();
  const row = database
    .prepare('SELECT * FROM guild_configs WHERE guild_id = ?')
    .get(guildId) as GuildConfigRecord | undefined;

  if (row) return mapRow(row);

  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO guild_configs (guild_id, updated_at) VALUES (?, ?)`,
    )
    .run(guildId, now);

  return getGuildConfig(guildId);
}

export function updateGuildConfig(
  guildId: string,
  patch: Partial<{
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
  }>,
): GuildConfig {
  const current = getGuildConfig(guildId);
  const next = {
    ticketsEnabled: patch.ticketsEnabled ?? current.ticketsEnabled,
    ticketCategoryId:
      patch.ticketCategoryId !== undefined ? patch.ticketCategoryId : current.ticketCategoryId,
    logChannelId: patch.logChannelId !== undefined ? patch.logChannelId : current.logChannelId,
    staffRoleIds: patch.staffRoleIds ?? current.staffRoleIds,
    ticketTypes: patch.ticketTypes ?? current.ticketTypes,
    welcomeMessageId:
      patch.welcomeMessageId !== undefined ? patch.welcomeMessageId : current.welcomeMessageId,
    rulesMessageId:
      patch.rulesMessageId !== undefined ? patch.rulesMessageId : current.rulesMessageId,
    servicesMessageId:
      patch.servicesMessageId !== undefined ? patch.servicesMessageId : current.servicesMessageId,
    pricingMessageId:
      patch.pricingMessageId !== undefined ? patch.pricingMessageId : current.pricingMessageId,
    ticketPanelMessageId:
      patch.ticketPanelMessageId !== undefined
        ? patch.ticketPanelMessageId
        : current.ticketPanelMessageId,
  };

  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE guild_configs SET
        tickets_enabled = ?,
        ticket_category_id = ?,
        log_channel_id = ?,
        staff_role_ids = ?,
        ticket_types = ?,
        welcome_message_id = ?,
        rules_message_id = ?,
        services_message_id = ?,
        pricing_message_id = ?,
        ticket_panel_message_id = ?,
        updated_at = ?
      WHERE guild_id = ?`,
    )
    .run(
      next.ticketsEnabled ? 1 : 0,
      next.ticketCategoryId,
      next.logChannelId,
      JSON.stringify(next.staffRoleIds),
      JSON.stringify(next.ticketTypes),
      next.welcomeMessageId,
      next.rulesMessageId,
      next.servicesMessageId,
      next.pricingMessageId,
      next.ticketPanelMessageId,
      now,
      guildId,
    );

  return getGuildConfig(guildId);
}
