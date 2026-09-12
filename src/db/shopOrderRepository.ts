import { randomBytes } from 'crypto';
import { getDb } from './index';

export type OrderStatus = 'pending' | 'ticket_created' | 'completed' | 'cancelled';

export interface ShopOrderItem {
  id: number;
  orderId: string;
  productId: string;
  productName: string;
  productEmoji: string;
  unitPrice: number | null;
  quantity: number;
  lineTotal: number | null;
}

export interface ShopOrder {
  id: string;
  guildId: string;
  userId: string;
  userTag: string;
  status: OrderStatus;
  subtotal: number | null;
  total: number | null;
  currency: string;
  ticketChannelId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: ShopOrderItem[];
}

interface OrderRow {
  id: string;
  guild_id: string;
  user_id: string;
  user_tag: string;
  status: string;
  subtotal: number | null;
  total: number | null;
  currency: string;
  ticket_channel_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: number;
  order_id: string;
  product_id: string;
  product_name: string;
  product_emoji: string;
  unit_price: number | null;
  quantity: number;
  line_total: number | null;
}

function mapItem(row: ItemRow): ShopOrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    productName: row.product_name,
    productEmoji: row.product_emoji,
    unitPrice: row.unit_price === null ? null : Number(row.unit_price),
    quantity: row.quantity,
    lineTotal: row.line_total === null ? null : Number(row.line_total),
  };
}

function mapOrder(row: OrderRow, items: ShopOrderItem[]): ShopOrder {
  return {
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    userTag: row.user_tag,
    status: row.status as OrderStatus,
    subtotal: row.subtotal === null ? null : Number(row.subtotal),
    total: row.total === null ? null : Number(row.total),
    currency: row.currency,
    ticketChannelId: row.ticket_channel_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
  };
}

function loadItems(orderId: string): ShopOrderItem[] {
  const rows = getDb()
    .prepare(`SELECT * FROM shop_order_items WHERE order_id = ? ORDER BY id ASC`)
    .all(orderId) as ItemRow[];
  return rows.map(mapItem);
}

export function generateOrderId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `ORD-${stamp}-${rand}`;
}

export function createOrder(input: {
  guildId: string;
  userId: string;
  userTag: string;
  items: Array<{
    productId: string;
    productName: string;
    productEmoji: string;
    unitPrice: number | null;
    quantity: number;
  }>;
  notes?: string;
}): ShopOrder {
  const db = getDb();
  const id = generateOrderId();
  const now = new Date().toISOString();

  let subtotal: number | null = 0;
  let hasNullPrice = false;
  for (const item of input.items) {
    if (item.unitPrice === null || item.unitPrice === undefined) {
      hasNullPrice = true;
    } else {
      subtotal! += item.unitPrice * item.quantity;
    }
  }
  if (hasNullPrice) subtotal = null;
  else subtotal = Math.round((subtotal || 0) * 100) / 100;

  const insertOrder = db.prepare(`
    INSERT INTO shop_orders
      (id, guild_id, user_id, user_tag, status, subtotal, total, currency, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, 'EUR', ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO shop_order_items
      (order_id, product_id, product_name, product_emoji, unit_price, quantity, line_total)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    insertOrder.run(
      id,
      input.guildId,
      input.userId,
      input.userTag,
      subtotal,
      subtotal,
      input.notes ?? null,
      now,
      now,
    );
    for (const item of input.items) {
      const lineTotal =
        item.unitPrice === null || item.unitPrice === undefined
          ? null
          : Math.round(item.unitPrice * item.quantity * 100) / 100;
      insertItem.run(
        id,
        item.productId,
        item.productName,
        item.productEmoji,
        item.unitPrice,
        item.quantity,
        lineTotal,
      );
    }
  });
  tx();

  return getOrder(id)!;
}

export function getOrder(id: string): ShopOrder | null {
  const row = getDb()
    .prepare(`SELECT * FROM shop_orders WHERE id = ?`)
    .get(id) as OrderRow | undefined;
  if (!row) return null;
  return mapOrder(row, loadItems(id));
}

export function listOrdersForGuild(guildId: string, limit = 50): ShopOrder[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM shop_orders WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(guildId, Math.min(limit, 100)) as OrderRow[];
  return rows.map((row) => mapOrder(row, loadItems(row.id)));
}

export function listOrdersForUser(userId: string, limit = 50): ShopOrder[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM shop_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(userId, Math.min(limit, 100)) as OrderRow[];
  return rows.map((row) => mapOrder(row, loadItems(row.id)));
}

export function updateOrderStatus(
  id: string,
  patch: { status?: OrderStatus; ticketChannelId?: string | null },
): ShopOrder | null {
  const current = getOrder(id);
  if (!current) return null;
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE shop_orders SET status = ?, ticket_channel_id = ?, updated_at = ? WHERE id = ?`,
    )
    .run(
      patch.status ?? current.status,
      patch.ticketChannelId !== undefined ? patch.ticketChannelId : current.ticketChannelId,
      now,
      id,
    );
  return getOrder(id);
}
