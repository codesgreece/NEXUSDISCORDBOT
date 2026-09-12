import { getProductsByIds } from '../db/shopProductRepository';
import { createOrder, getOrder, type ShopOrder } from '../db/shopOrderRepository';
import { createOrderTicket } from './shopOrderService';

export interface CheckoutItemInput {
  productId: string;
  quantity: number;
}

export async function checkoutShopOrder(input: {
  guildId: string;
  userId: string;
  userTag: string;
  items: CheckoutItemInput[];
  notes?: string;
}): Promise<{ order: ShopOrder; ticketChannelId: string }> {
  const cleaned = input.items
    .map((item) => ({
      productId: String(item.productId || '').trim(),
      quantity: Math.min(99, Math.max(1, Math.floor(Number(item.quantity) || 1))),
    }))
    .filter((item) => item.productId);

  if (!cleaned.length) {
    throw new Error('Cart is empty');
  }

  const products = getProductsByIds(cleaned.map((i) => i.productId));
  const byId = new Map(products.map((p) => [p.id, p]));

  const orderItems: Array<{
    productId: string;
    productName: string;
    productEmoji: string;
    unitPrice: number | null;
    quantity: number;
  }> = [];

  for (const line of cleaned) {
    const product = byId.get(line.productId);
    if (!product) {
      throw new Error(`Unknown product: ${line.productId}`);
    }
    if (!product.active) {
      throw new Error(`Product is not available: ${product.name}`);
    }
    orderItems.push({
      productId: product.id,
      productName: product.name,
      productEmoji: product.emoji,
      unitPrice: product.price,
      quantity: line.quantity,
    });
  }

  const order = createOrder({
    guildId: input.guildId,
    userId: input.userId,
    userTag: input.userTag,
    items: orderItems,
    notes: input.notes,
  });

  const { channelId } = await createOrderTicket(order);
  const refreshed = getOrder(order.id) ?? order;

  return { order: refreshed, ticketChannelId: channelId };
}
