/**
 * Guild-scoped control-center configuration & related entities.
 * All rows are keyed by guild_id — never share config across guilds.
 */
import { randomUUID } from 'crypto';
import { getDb } from './index';

function now(): string {
  return new Date().toISOString();
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------------ */
/*  Guild settings bag (flexible JSON keyed settings)                 */
/* ------------------------------------------------------------------ */

export type GuildSettingKey =
  | 'role_bindings'
  | 'welcome'
  | 'automod'
  | 'ticket_settings'
  | 'security'
  | 'shop_settings'
  | 'moderation_defaults';

export interface RoleBindings {
  adminRoleId: string | null;
  staffRoleId: string | null;
  moderatorRoleId: string | null;
  customerRoleId: string | null;
  botRoleId: string | null;
  verifiedRoleId: string | null;
  autoRoleId: string | null;
}

export interface WelcomeSettings {
  enabled: boolean;
  channelId: string | null;
  title: string;
  description: string;
  color: string;
  thumbnail: boolean;
  imageUrl: string | null;
  footer: string;
  autoRoleId: string | null;
  dmEnabled: boolean;
  dmMessage: string;
  leaveEnabled: boolean;
  leaveChannelId: string | null;
  leaveMessage: string;
}

export interface AutomodRule {
  enabled: boolean;
  threshold: number;
  action: 'warn' | 'delete' | 'timeout' | 'kick' | 'ban';
  timeoutMinutes: number;
  logChannelId: string | null;
}

export interface AutomodSettings {
  antiSpam: AutomodRule;
  antiFlood: AutomodRule;
  antiLink: AutomodRule;
  antiInvite: AutomodRule;
  antiMention: AutomodRule;
  badWords: AutomodRule & { words: string[] };
  capsProtect: AutomodRule;
  duplicateMessages: AutomodRule;
  raidDetection: AutomodRule;
  joinSpam: AutomodRule;
  accountAge: AutomodRule & { minDays: number };
}

export interface TicketSettingsExtra {
  transcriptChannelId: string | null;
  nameFormat: string;
  maxPerUser: number;
  autoCloseHours: number;
  claimEnabled: boolean;
  openMessage: string;
  closeMessage: string;
}

export interface SecuritySettings {
  requireConfirmDangerous: boolean;
  rateLimitPerMinute: number;
  commandCooldownSeconds: number;
  auditLogging: boolean;
}

const DEFAULT_ROLE_BINDINGS: RoleBindings = {
  adminRoleId: null,
  staffRoleId: null,
  moderatorRoleId: null,
  customerRoleId: null,
  botRoleId: null,
  verifiedRoleId: null,
  autoRoleId: null,
};

function defaultAutomodRule(overrides?: Partial<AutomodRule>): AutomodRule {
  return {
    enabled: false,
    threshold: 5,
    action: 'warn',
    timeoutMinutes: 10,
    logChannelId: null,
    ...overrides,
  };
}

export const DEFAULT_WELCOME: WelcomeSettings = {
  enabled: false,
  channelId: null,
  title: 'Καλωσήρθες στο {server}!',
  description: 'Γεια σου {user}! Είσαι το μέλος #{memberCount}.',
  color: '#5865F2',
  thumbnail: true,
  imageUrl: null,
  footer: 'NEXUS | DEVELOPMENT',
  autoRoleId: null,
  dmEnabled: false,
  dmMessage: 'Καλωσήρθες στο {server}!',
  leaveEnabled: false,
  leaveChannelId: null,
  leaveMessage: '{username} αποχώρησε από το {server}.',
};

export const DEFAULT_AUTOMOD: AutomodSettings = {
  antiSpam: defaultAutomodRule({ threshold: 5, action: 'timeout' }),
  antiFlood: defaultAutomodRule({ threshold: 4, action: 'delete' }),
  antiLink: defaultAutomodRule({ threshold: 1, action: 'delete' }),
  antiInvite: defaultAutomodRule({ threshold: 1, action: 'delete' }),
  antiMention: defaultAutomodRule({ threshold: 5, action: 'timeout' }),
  badWords: { ...defaultAutomodRule({ threshold: 1, action: 'delete' }), words: [] },
  capsProtect: defaultAutomodRule({ threshold: 70, action: 'delete' }),
  duplicateMessages: defaultAutomodRule({ threshold: 3, action: 'delete' }),
  raidDetection: defaultAutomodRule({ threshold: 10, action: 'kick' }),
  joinSpam: defaultAutomodRule({ threshold: 8, action: 'kick' }),
  accountAge: { ...defaultAutomodRule({ threshold: 1, action: 'kick' }), minDays: 3 },
};

export const DEFAULT_TICKET_EXTRA: TicketSettingsExtra = {
  transcriptChannelId: null,
  nameFormat: 'ticket-{username}',
  maxPerUser: 1,
  autoCloseHours: 0,
  claimEnabled: true,
  openMessage: 'Το ticket σου δημιουργήθηκε. Ένα μέλος του staff θα σε βοηθήσει σύντομα.',
  closeMessage: 'Το ticket έκλεισε.',
};

export const DEFAULT_SECURITY: SecuritySettings = {
  requireConfirmDangerous: true,
  rateLimitPerMinute: 20,
  commandCooldownSeconds: 2,
  auditLogging: true,
};

export function getGuildSetting<T>(guildId: string, key: GuildSettingKey, fallback: T): T {
  const row = getDb()
    .prepare(`SELECT value_json FROM guild_settings WHERE guild_id = ? AND key = ?`)
    .get(guildId, key) as { value_json: string } | undefined;
  return parseJson(row?.value_json, fallback);
}

export function setGuildSetting(guildId: string, key: GuildSettingKey, value: unknown): void {
  getDb()
    .prepare(
      `INSERT INTO guild_settings (guild_id, key, value_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(guild_id, key) DO UPDATE SET
         value_json = excluded.value_json,
         updated_at = excluded.updated_at`,
    )
    .run(guildId, key, JSON.stringify(value), now());
}

export function getRoleBindings(guildId: string): RoleBindings {
  return getGuildSetting(guildId, 'role_bindings', DEFAULT_ROLE_BINDINGS);
}

export function setRoleBindings(guildId: string, patch: Partial<RoleBindings>): RoleBindings {
  const next = { ...getRoleBindings(guildId), ...patch };
  setGuildSetting(guildId, 'role_bindings', next);
  return next;
}

export function getWelcomeSettings(guildId: string): WelcomeSettings {
  return getGuildSetting(guildId, 'welcome', DEFAULT_WELCOME);
}

export function setWelcomeSettings(guildId: string, patch: Partial<WelcomeSettings>): WelcomeSettings {
  const next = { ...getWelcomeSettings(guildId), ...patch };
  setGuildSetting(guildId, 'welcome', next);
  return next;
}

export function getAutomodSettings(guildId: string): AutomodSettings {
  return getGuildSetting(guildId, 'automod', DEFAULT_AUTOMOD);
}

export function setAutomodSettings(guildId: string, value: AutomodSettings): AutomodSettings {
  setGuildSetting(guildId, 'automod', value);
  return value;
}

export function getTicketExtraSettings(guildId: string): TicketSettingsExtra {
  return getGuildSetting(guildId, 'ticket_settings', DEFAULT_TICKET_EXTRA);
}

export function setTicketExtraSettings(
  guildId: string,
  patch: Partial<TicketSettingsExtra>,
): TicketSettingsExtra {
  const next = { ...getTicketExtraSettings(guildId), ...patch };
  setGuildSetting(guildId, 'ticket_settings', next);
  return next;
}

export function getSecuritySettings(guildId: string): SecuritySettings {
  return getGuildSetting(guildId, 'security', DEFAULT_SECURITY);
}

export function setSecuritySettings(
  guildId: string,
  patch: Partial<SecuritySettings>,
): SecuritySettings {
  const next = { ...getSecuritySettings(guildId), ...patch };
  setGuildSetting(guildId, 'security', next);
  return next;
}

/* ------------------------------------------------------------------ */
/*  Moderation cases / warnings                                       */
/* ------------------------------------------------------------------ */

export interface ModerationCase {
  id: string;
  guildId: string;
  userId: string;
  moderatorId: string;
  type: string;
  reason: string | null;
  durationMinutes: number | null;
  active: boolean;
  createdAt: string;
}

export function createModerationCase(input: {
  guildId: string;
  userId: string;
  moderatorId: string;
  type: string;
  reason?: string | null;
  durationMinutes?: number | null;
}): ModerationCase {
  const id = randomUUID();
  const createdAt = now();
  getDb()
    .prepare(
      `INSERT INTO moderation_cases
        (id, guild_id, user_id, moderator_id, type, reason, duration_minutes, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(
      id,
      input.guildId,
      input.userId,
      input.moderatorId,
      input.type,
      input.reason ?? null,
      input.durationMinutes ?? null,
      createdAt,
    );
  return {
    id,
    guildId: input.guildId,
    userId: input.userId,
    moderatorId: input.moderatorId,
    type: input.type,
    reason: input.reason ?? null,
    durationMinutes: input.durationMinutes ?? null,
    active: true,
    createdAt,
  };
}

export function listModerationCases(guildId: string, userId?: string, limit = 25): ModerationCase[] {
  const rows = userId
    ? (getDb()
        .prepare(
          `SELECT * FROM moderation_cases WHERE guild_id = ? AND user_id = ?
           ORDER BY created_at DESC LIMIT ?`,
        )
        .all(guildId, userId, limit) as Array<Record<string, unknown>>)
    : (getDb()
        .prepare(
          `SELECT * FROM moderation_cases WHERE guild_id = ?
           ORDER BY created_at DESC LIMIT ?`,
        )
        .all(guildId, limit) as Array<Record<string, unknown>>);

  return rows.map((r) => ({
    id: String(r.id),
    guildId: String(r.guild_id),
    userId: String(r.user_id),
    moderatorId: String(r.moderator_id),
    type: String(r.type),
    reason: (r.reason as string | null) ?? null,
    durationMinutes: (r.duration_minutes as number | null) ?? null,
    active: Boolean(r.active),
    createdAt: String(r.created_at),
  }));
}

export function clearWarnings(guildId: string, userId: string): number {
  const result = getDb()
    .prepare(
      `UPDATE moderation_cases SET active = 0
       WHERE guild_id = ? AND user_id = ? AND type = 'warn' AND active = 1`,
    )
    .run(guildId, userId);
  return result.changes;
}

/* ------------------------------------------------------------------ */
/*  Managed Discord messages (edit-or-create sync)                    */
/* ------------------------------------------------------------------ */

export function upsertManagedMessage(input: {
  guildId: string;
  contentType: string;
  entityId: string;
  channelId: string;
  messageId: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO managed_messages
        (guild_id, content_type, entity_id, channel_id, message_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(guild_id, content_type, entity_id) DO UPDATE SET
         channel_id = excluded.channel_id,
         message_id = excluded.message_id,
         updated_at = excluded.updated_at`,
    )
    .run(
      input.guildId,
      input.contentType,
      input.entityId,
      input.channelId,
      input.messageId,
      now(),
    );
}

export function getManagedMessage(
  guildId: string,
  contentType: string,
  entityId: string,
): { channelId: string; messageId: string } | null {
  const row = getDb()
    .prepare(
      `SELECT channel_id, message_id FROM managed_messages
       WHERE guild_id = ? AND content_type = ? AND entity_id = ?`,
    )
    .get(guildId, contentType, entityId) as
    | { channel_id: string; message_id: string }
    | undefined;
  if (!row) return null;
  return { channelId: row.channel_id, messageId: row.message_id };
}

/* ------------------------------------------------------------------ */
/*  Reviews / Projects                                                */
/* ------------------------------------------------------------------ */

export function createReview(input: {
  guildId: string;
  orderId: string | null;
  userId: string;
  productId: string | null;
  rating: number;
  comment: string;
}): string {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO reviews
        (id, guild_id, order_id, user_id, product_id, rating, comment, approved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .run(
      id,
      input.guildId,
      input.orderId,
      input.userId,
      input.productId,
      Math.min(5, Math.max(1, Math.round(input.rating))),
      input.comment.slice(0, 1000),
      now(),
    );
  return id;
}

export function listReviews(guildId: string, approvedOnly = false) {
  const sql = approvedOnly
    ? `SELECT * FROM reviews WHERE guild_id = ? AND approved = 1 ORDER BY created_at DESC LIMIT 50`
    : `SELECT * FROM reviews WHERE guild_id = ? ORDER BY created_at DESC LIMIT 50`;
  return getDb().prepare(sql).all(guildId) as Array<Record<string, unknown>>;
}

export function setReviewApproved(id: string, approved: boolean): void {
  getDb().prepare(`UPDATE reviews SET approved = ? WHERE id = ?`).run(approved ? 1 : 0, id);
}

export function createProject(input: {
  guildId: string;
  name: string;
  description: string;
  category: string;
  imageUrl?: string | null;
  url?: string | null;
  status?: string;
}): string {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO projects
        (id, guild_id, name, description, category, image_url, url, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.guildId,
      input.name.slice(0, 100),
      input.description.slice(0, 2000),
      input.category,
      input.imageUrl ?? null,
      input.url ?? null,
      input.status ?? 'PLANNED',
      now(),
      now(),
    );
  return id;
}

export function listProjects(guildId: string) {
  return getDb()
    .prepare(`SELECT * FROM projects WHERE guild_id = ? ORDER BY updated_at DESC LIMIT 50`)
    .all(guildId) as Array<Record<string, unknown>>;
}

export function updateProject(
  id: string,
  patch: Partial<{
    name: string;
    description: string;
    category: string;
    imageUrl: string | null;
    url: string | null;
    status: string;
  }>,
): void {
  const row = getDb().prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return;
  getDb()
    .prepare(
      `UPDATE projects SET
        name = ?, description = ?, category = ?, image_url = ?, url = ?, status = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      patch.name ?? row.name,
      patch.description ?? row.description,
      patch.category ?? row.category,
      patch.imageUrl !== undefined ? patch.imageUrl : row.image_url,
      patch.url !== undefined ? patch.url : row.url,
      patch.status ?? row.status,
      now(),
      id,
    );
}

/* ------------------------------------------------------------------ */
/*  Backups                                                           */
/* ------------------------------------------------------------------ */

export function createBackup(guildId: string, label: string, payload: unknown): string {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO guild_backups (id, guild_id, label, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, guildId, label.slice(0, 120), JSON.stringify(payload), now());
  return id;
}

export function listBackups(guildId: string) {
  return getDb()
    .prepare(
      `SELECT id, label, created_at FROM guild_backups
       WHERE guild_id = ? ORDER BY created_at DESC LIMIT 25`,
    )
    .all(guildId) as Array<{ id: string; label: string; created_at: string }>;
}

export function getBackup(id: string): { id: string; guildId: string; payload: unknown } | null {
  const row = getDb()
    .prepare(`SELECT id, guild_id, payload_json FROM guild_backups WHERE id = ?`)
    .get(id) as { id: string; guild_id: string; payload_json: string } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    guildId: row.guild_id,
    payload: parseJson(row.payload_json, {}),
  };
}
