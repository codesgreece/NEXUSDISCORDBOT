import { getDb } from './index';
import { PRODUCT_CATEGORIES } from '../config/contentMapping';

export interface ShopCategory {
  key: string;
  name: string;
  emoji: string;
  channelName: string;
  shopVisible: boolean;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CategoryRow {
  key: string;
  name: string;
  emoji: string;
  channel_name: string;
  shop_visible: number;
  sort_order: number;
  active: number;
  created_at: string;
  updated_at: string;
}

function mapCategory(row: CategoryRow): ShopCategory {
  return {
    key: row.key,
    name: row.name,
    emoji: row.emoji,
    channelName: row.channel_name,
    shopVisible: Boolean(row.shop_visible),
    sortOrder: row.sort_order,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listCategories(options?: {
  activeOnly?: boolean;
  shopVisibleOnly?: boolean;
}): ShopCategory[] {
  const db = getDb();
  let rows = db
    .prepare(`SELECT * FROM shop_categories ORDER BY sort_order ASC, name ASC`)
    .all() as CategoryRow[];
  if (options?.activeOnly) rows = rows.filter((r) => r.active);
  if (options?.shopVisibleOnly) rows = rows.filter((r) => r.shop_visible);
  return rows.map(mapCategory);
}

export function getCategory(key: string): ShopCategory | null {
  const row = getDb()
    .prepare(`SELECT * FROM shop_categories WHERE key = ?`)
    .get(key) as CategoryRow | undefined;
  return row ? mapCategory(row) : null;
}

export function createCategory(input: {
  key: string;
  name: string;
  emoji?: string;
  channelName: string;
  shopVisible?: boolean;
  sortOrder?: number;
}): ShopCategory {
  const now = new Date().toISOString();
  const key = input.key
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .slice(0, 64);
  getDb()
    .prepare(
      `INSERT INTO shop_categories
        (key, name, emoji, channel_name, shop_visible, sort_order, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(
      key,
      input.name.trim().slice(0, 80),
      (input.emoji || '📦').slice(0, 16),
      input.channelName.trim().slice(0, 100),
      input.shopVisible === false ? 0 : 1,
      input.sortOrder ?? 100,
      now,
      now,
    );
  return getCategory(key)!;
}

export function updateCategory(
  key: string,
  patch: Partial<{
    name: string;
    emoji: string;
    channelName: string;
    shopVisible: boolean;
    sortOrder: number;
    active: boolean;
  }>,
): ShopCategory | null {
  const current = getCategory(key);
  if (!current) return null;
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE shop_categories SET
        name = ?, emoji = ?, channel_name = ?, shop_visible = ?,
        sort_order = ?, active = ?, updated_at = ?
       WHERE key = ?`,
    )
    .run(
      patch.name?.trim().slice(0, 80) ?? current.name,
      patch.emoji?.slice(0, 16) ?? current.emoji,
      patch.channelName?.trim().slice(0, 100) ?? current.channelName,
      (patch.shopVisible !== undefined ? patch.shopVisible : current.shopVisible) ? 1 : 0,
      patch.sortOrder ?? current.sortOrder,
      (patch.active !== undefined ? patch.active : current.active) ? 1 : 0,
      now,
      key,
    );
  return getCategory(key);
}

export interface GuildSyncState {
  guildId: string;
  categoryKey: string;
  channelId: string | null;
  headerMessageId: string | null;
  updatedAt: string;
}

export function getGuildSync(guildId: string, categoryKey: string): GuildSyncState | null {
  const row = getDb()
    .prepare(`SELECT * FROM shop_guild_sync WHERE guild_id = ? AND category_key = ?`)
    .get(guildId, categoryKey) as
    | {
        guild_id: string;
        category_key: string;
        channel_id: string | null;
        header_message_id: string | null;
        updated_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    guildId: row.guild_id,
    categoryKey: row.category_key,
    channelId: row.channel_id,
    headerMessageId: row.header_message_id,
    updatedAt: row.updated_at,
  };
}

export function upsertGuildSync(
  guildId: string,
  categoryKey: string,
  patch: { channelId?: string | null; headerMessageId?: string | null },
): void {
  const now = new Date().toISOString();
  const current = getGuildSync(guildId, categoryKey);
  if (!current) {
    getDb()
      .prepare(
        `INSERT INTO shop_guild_sync
          (guild_id, category_key, channel_id, header_message_id, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        guildId,
        categoryKey,
        patch.channelId ?? null,
        patch.headerMessageId ?? null,
        now,
      );
    return;
  }
  getDb()
    .prepare(
      `UPDATE shop_guild_sync SET
        channel_id = ?, header_message_id = ?, updated_at = ?
       WHERE guild_id = ? AND category_key = ?`,
    )
    .run(
      patch.channelId !== undefined ? patch.channelId : current.channelId,
      patch.headerMessageId !== undefined ? patch.headerMessageId : current.headerMessageId,
      now,
      guildId,
      categoryKey,
    );
}

/** Ensure config defaults exist even if DB seed missed a row */
export function ensureDefaultCategories(): void {
  for (const def of PRODUCT_CATEGORIES) {
    if (!getCategory(def.key)) {
      createCategory({
        key: def.key,
        name: def.name,
        emoji: def.emoji,
        channelName: def.channelName,
        shopVisible: def.shopVisible,
        sortOrder: def.sortOrder,
      });
    }
  }
}
