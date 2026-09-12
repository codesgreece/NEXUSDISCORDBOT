import { getDb } from './index';

export interface ShopProduct {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  description: string;
  price: number | null;
  category: string;
  imageUrl: string | null;
  active: boolean;
  sortOrder: number;
  discordChannelId: string | null;
  discordMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProductRow {
  id: string;
  name: string;
  slug: string | null;
  emoji: string;
  description: string;
  price: number | null;
  category: string | null;
  image_url: string | null;
  active: number;
  sort_order: number;
  discord_channel_id: string | null;
  discord_message_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapProduct(row: ProductRow): ShopProduct {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug || row.id,
    emoji: row.emoji,
    description: row.description,
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    category: row.category || 'DISCORD_BOTS',
    imageUrl: row.image_url,
    active: Boolean(row.active),
    sortOrder: row.sort_order,
    discordChannelId: row.discord_channel_id,
    discordMessageId: row.discord_message_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listProducts(options?: {
  activeOnly?: boolean;
  category?: string;
}): ShopProduct[] {
  const db = getDb();
  const activeOnly = Boolean(options?.activeOnly);
  if (options?.category && activeOnly) {
    return (
      db
        .prepare(
          `SELECT * FROM shop_products
           WHERE active = 1 AND category = ?
           ORDER BY sort_order ASC, name ASC`,
        )
        .all(options.category) as ProductRow[]
    ).map(mapProduct);
  }
  if (options?.category) {
    return (
      db
        .prepare(
          `SELECT * FROM shop_products WHERE category = ? ORDER BY sort_order ASC, name ASC`,
        )
        .all(options.category) as ProductRow[]
    ).map(mapProduct);
  }
  if (activeOnly) {
    return (
      db
        .prepare(
          `SELECT * FROM shop_products WHERE active = 1 ORDER BY sort_order ASC, name ASC`,
        )
        .all() as ProductRow[]
    ).map(mapProduct);
  }
  return (
    db
      .prepare(`SELECT * FROM shop_products ORDER BY sort_order ASC, name ASC`)
      .all() as ProductRow[]
  ).map(mapProduct);
}

export function getProduct(id: string): ShopProduct | null {
  const row = getDb()
    .prepare(`SELECT * FROM shop_products WHERE id = ?`)
    .get(id) as ProductRow | undefined;
  return row ? mapProduct(row) : null;
}

export function getProductsByIds(ids: string[]): ShopProduct[] {
  if (!ids.length) return [];
  const unique = [...new Set(ids)];
  const placeholders = unique.map(() => '?').join(',');
  const rows = getDb()
    .prepare(
      `SELECT * FROM shop_products WHERE id IN (${placeholders}) ORDER BY sort_order ASC`,
    )
    .all(...unique) as ProductRow[];
  return rows.map(mapProduct);
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || `product-${Date.now()}`
  );
}

export function createProduct(input: {
  id?: string;
  name: string;
  slug?: string;
  emoji?: string;
  description?: string;
  price?: number | null;
  category?: string;
  imageUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
}): ShopProduct {
  const db = getDb();
  const now = new Date().toISOString();
  let id = (input.id || slugify(input.name)).slice(0, 64);
  if (getProduct(id)) {
    id = `${id}-${Date.now().toString(36)}`;
  }
  const slug = (input.slug || id).slice(0, 64);

  db.prepare(
    `INSERT INTO shop_products
      (id, name, slug, emoji, description, price, category, image_url, active, sort_order,
       discord_channel_id, discord_message_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
  ).run(
    id,
    input.name.trim().slice(0, 120),
    slug,
    (input.emoji || '🤖').slice(0, 16),
    (input.description || '').slice(0, 1000),
    input.price === undefined ? null : input.price,
    (input.category || 'DISCORD_BOTS').slice(0, 64),
    input.imageUrl ?? null,
    input.active === false ? 0 : 1,
    input.sortOrder ?? 100,
    now,
    now,
  );

  return getProduct(id)!;
}

export function updateProduct(
  id: string,
  patch: Partial<{
    name: string;
    slug: string;
    emoji: string;
    description: string;
    price: number | null;
    category: string;
    imageUrl: string | null;
    active: boolean;
    sortOrder: number;
    discordChannelId: string | null;
    discordMessageId: string | null;
  }>,
): ShopProduct | null {
  const current = getProduct(id);
  if (!current) return null;

  const next = {
    name: patch.name?.trim().slice(0, 120) ?? current.name,
    slug: patch.slug?.slice(0, 64) ?? current.slug,
    emoji: patch.emoji?.slice(0, 16) ?? current.emoji,
    description: patch.description?.slice(0, 1000) ?? current.description,
    price: patch.price !== undefined ? patch.price : current.price,
    category: patch.category?.slice(0, 64) ?? current.category,
    imageUrl: patch.imageUrl !== undefined ? patch.imageUrl : current.imageUrl,
    active: patch.active !== undefined ? patch.active : current.active,
    sortOrder: patch.sortOrder ?? current.sortOrder,
    discordChannelId:
      patch.discordChannelId !== undefined ? patch.discordChannelId : current.discordChannelId,
    discordMessageId:
      patch.discordMessageId !== undefined ? patch.discordMessageId : current.discordMessageId,
  };
  const now = new Date().toISOString();

  getDb()
    .prepare(
      `UPDATE shop_products SET
        name = ?, slug = ?, emoji = ?, description = ?, price = ?, category = ?,
        image_url = ?, active = ?, sort_order = ?,
        discord_channel_id = ?, discord_message_id = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      next.name,
      next.slug,
      next.emoji,
      next.description,
      next.price,
      next.category,
      next.imageUrl,
      next.active ? 1 : 0,
      next.sortOrder,
      next.discordChannelId,
      next.discordMessageId,
      now,
      id,
    );

  return getProduct(id);
}

export function deleteProduct(id: string): boolean {
  const result = getDb().prepare(`DELETE FROM shop_products WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function clearDiscordMessage(id: string): void {
  updateProduct(id, { discordChannelId: null, discordMessageId: null });
}
