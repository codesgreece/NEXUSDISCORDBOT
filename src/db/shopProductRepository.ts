import { getDb } from './index';

export interface ShopProduct {
  id: string;
  name: string;
  emoji: string;
  description: string;
  price: number | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ProductRow {
  id: string;
  name: string;
  emoji: string;
  description: string;
  price: number | null;
  active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function mapProduct(row: ProductRow): ShopProduct {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    description: row.description,
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    active: Boolean(row.active),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listProducts(options?: { activeOnly?: boolean }): ShopProduct[] {
  const db = getDb();
  const rows = options?.activeOnly
    ? (db
        .prepare(
          `SELECT * FROM shop_products WHERE active = 1 ORDER BY sort_order ASC, name ASC`,
        )
        .all() as ProductRow[])
    : (db
        .prepare(`SELECT * FROM shop_products ORDER BY sort_order ASC, name ASC`)
        .all() as ProductRow[]);
  return rows.map(mapProduct);
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
  emoji?: string;
  description?: string;
  price?: number | null;
  active?: boolean;
  sortOrder?: number;
}): ShopProduct {
  const db = getDb();
  const now = new Date().toISOString();
  let id = (input.id || slugify(input.name)).slice(0, 64);
  if (getProduct(id)) {
    id = `${id}-${Date.now().toString(36)}`;
  }

  db.prepare(
    `INSERT INTO shop_products
      (id, name, emoji, description, price, active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.name.trim().slice(0, 120),
    (input.emoji || '🤖').slice(0, 16),
    (input.description || '').slice(0, 1000),
    input.price === undefined ? null : input.price,
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
    emoji: string;
    description: string;
    price: number | null;
    active: boolean;
    sortOrder: number;
  }>,
): ShopProduct | null {
  const current = getProduct(id);
  if (!current) return null;

  const next = {
    name: patch.name?.trim().slice(0, 120) ?? current.name,
    emoji: patch.emoji?.slice(0, 16) ?? current.emoji,
    description: patch.description?.slice(0, 1000) ?? current.description,
    price: patch.price !== undefined ? patch.price : current.price,
    active: patch.active !== undefined ? patch.active : current.active,
    sortOrder: patch.sortOrder ?? current.sortOrder,
  };
  const now = new Date().toISOString();

  getDb()
    .prepare(
      `UPDATE shop_products SET
        name = ?, emoji = ?, description = ?, price = ?, active = ?,
        sort_order = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      next.name,
      next.emoji,
      next.description,
      next.price,
      next.active ? 1 : 0,
      next.sortOrder,
      now,
      id,
    );

  return getProduct(id);
}

export function deleteProduct(id: string): boolean {
  const result = getDb().prepare(`DELETE FROM shop_products WHERE id = ?`).run(id);
  return result.changes > 0;
}
