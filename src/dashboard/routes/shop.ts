import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getSessionUser } from '../types';
import {
  assertGuildAccess,
  assertGuildManage,
  GuildAccessError,
} from '../../services/guildAccessService';
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from '../../db/shopProductRepository';
import { getOrder, listOrdersForGuild, listOrdersForUser } from '../../db/shopOrderRepository';
import { checkoutShopOrder } from '../../services/shopCheckoutService';

export const shopRouter = Router({ mergeParams: true });

shopRouter.use(requireAuth);

function gid(req: import('express').Request): string {
  return (req.params as { guildId: string }).guildId;
}

function handleError(res: import('express').Response, error: unknown, fallback: string) {
  if (error instanceof GuildAccessError) {
    res.status(error.status ?? 403).json({ error: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : fallback;
  console.error('[API] shop:', fallback, error);
  res.status(400).json({ error: message || fallback });
}

/** Active catalog for the Bot Shop storefront */
shopRouter.get('/products', async (req, res) => {
  try {
    const user = getSessionUser(req)!;
    await assertGuildAccess(user.accessToken, gid(req), user.id);
    const products = listProducts({ activeOnly: true });
    res.json({ products });
  } catch (error) {
    handleError(res, error, 'Failed to load shop products');
  }
});

/** Full catalog including inactive (managers) */
shopRouter.get('/products/manage', async (req, res) => {
  try {
    const user = getSessionUser(req)!;
    await assertGuildManage(user.accessToken, gid(req), user.id);
    res.json({ products: listProducts() });
  } catch (error) {
    handleError(res, error, 'Failed to load products for management');
  }
});

shopRouter.post('/products', async (req, res) => {
  try {
    const user = getSessionUser(req)!;
    await assertGuildManage(user.accessToken, gid(req), user.id);
    const name = String(req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ error: 'Product name is required' });
      return;
    }
    let price: number | null = null;
    if (req.body?.price !== undefined && req.body?.price !== null && req.body?.price !== '') {
      const n = Number(req.body.price);
      if (!Number.isFinite(n) || n < 0) {
        res.status(400).json({ error: 'Invalid price' });
        return;
      }
      price = Math.round(n * 100) / 100;
    }
    const product = createProduct({
      name,
      emoji: req.body?.emoji,
      description: req.body?.description,
      price,
      active: req.body?.active !== false,
      sortOrder: req.body?.sortOrder !== undefined ? Number(req.body.sortOrder) : undefined,
      id: req.body?.id,
    });
    res.status(201).json({ product });
  } catch (error) {
    handleError(res, error, 'Failed to create product');
  }
});

shopRouter.patch('/products/:productId', async (req, res) => {
  try {
    const user = getSessionUser(req)!;
    await assertGuildManage(user.accessToken, gid(req), user.id);
    const patch: Parameters<typeof updateProduct>[1] = {};
    if (req.body?.name !== undefined) patch.name = String(req.body.name);
    if (req.body?.emoji !== undefined) patch.emoji = String(req.body.emoji);
    if (req.body?.description !== undefined) patch.description = String(req.body.description);
    if (req.body?.active !== undefined) patch.active = Boolean(req.body.active);
    if (req.body?.sortOrder !== undefined) patch.sortOrder = Number(req.body.sortOrder);
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'price')) {
      if (req.body.price === null || req.body.price === '') {
        patch.price = null;
      } else {
        const n = Number(req.body.price);
        if (!Number.isFinite(n) || n < 0) {
          res.status(400).json({ error: 'Invalid price' });
          return;
        }
        patch.price = Math.round(n * 100) / 100;
      }
    }
    const product = updateProduct(req.params.productId, patch);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json({ product });
  } catch (error) {
    handleError(res, error, 'Failed to update product');
  }
});

shopRouter.delete('/products/:productId', async (req, res) => {
  try {
    const user = getSessionUser(req)!;
    await assertGuildManage(user.accessToken, gid(req), user.id);
    if (!getProduct(req.params.productId)) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    deleteProduct(req.params.productId);
    res.json({ ok: true });
  } catch (error) {
    handleError(res, error, 'Failed to delete product');
  }
});

/**
 * Checkout — creates an order record and opens a Discord order ticket.
 * No payment provider yet; ready for future integration.
 */
shopRouter.post('/checkout', async (req, res) => {
  try {
    const user = getSessionUser(req)!;
    await assertGuildAccess(user.accessToken, gid(req), user.id);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) {
      res.status(400).json({ error: 'Cart is empty' });
      return;
    }
    const result = await checkoutShopOrder({
      guildId: gid(req),
      userId: user.id,
      userTag: user.username,
      items: items.map((item: { productId?: string; quantity?: number }) => ({
        productId: String(item.productId ?? ''),
        quantity: Number(item.quantity) || 1,
      })),
      notes: req.body?.notes ? String(req.body.notes).slice(0, 1000) : undefined,
    });
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, 'Checkout failed');
  }
});

shopRouter.get('/orders', async (req, res) => {
  try {
    const user = getSessionUser(req)!;
    await assertGuildAccess(user.accessToken, gid(req), user.id);
    const scope = String(req.query.scope || 'mine');
    if (scope === 'all') {
      await assertGuildManage(user.accessToken, gid(req), user.id);
      res.json({ orders: listOrdersForGuild(gid(req), Number(req.query.limit) || 50) });
      return;
    }
    res.json({
      orders: listOrdersForUser(user.id, Number(req.query.limit) || 50).filter(
        (o) => o.guildId === gid(req),
      ),
    });
  } catch (error) {
    handleError(res, error, 'Failed to load orders');
  }
});

shopRouter.get('/orders/:orderId', async (req, res) => {
  try {
    const user = getSessionUser(req)!;
    await assertGuildAccess(user.accessToken, gid(req), user.id);
    const order = getOrder(req.params.orderId);
    if (!order || order.guildId !== gid(req)) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    if (order.userId !== user.id) {
      await assertGuildManage(user.accessToken, gid(req), user.id);
    }
    res.json({ order });
  } catch (error) {
    handleError(res, error, 'Failed to load order');
  }
});
