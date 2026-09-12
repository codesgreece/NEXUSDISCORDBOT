import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './useAuth';
import { useGuildId } from '../components/ui';

export interface CartProductSnapshot {
  id: string;
  name: string;
  emoji: string;
  description: string;
  price: number | null;
}

export interface CartLine {
  product: CartProductSnapshot;
  quantity: number;
}

interface CartContextValue {
  lines: CartLine[];
  itemCount: number;
  subtotal: number | null;
  hasQuoteItems: boolean;
  addItem: (product: CartProductSnapshot, qty?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(guildId: string, userId: string) {
  return `nexus-shop-cart:${guildId}:${userId}`;
}

function computeSubtotal(lines: CartLine[]): { subtotal: number | null; hasQuoteItems: boolean } {
  let sum = 0;
  let hasQuoteItems = false;
  for (const line of lines) {
    if (line.product.price === null || line.product.price === undefined) {
      hasQuoteItems = true;
    } else {
      sum += line.product.price * line.quantity;
    }
  }
  if (!lines.length) return { subtotal: 0, hasQuoteItems: false };
  if (hasQuoteItems) return { subtotal: null, hasQuoteItems };
  return { subtotal: Math.round(sum * 100) / 100, hasQuoteItems };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const guildId = useGuildId();
  const { user } = useAuth();
  const userId = user?.id ?? 'anon';
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    if (!guildId || !userId) {
      setLines([]);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey(guildId, userId));
      if (!raw) {
        setLines([]);
        return;
      }
      const parsed = JSON.parse(raw) as CartLine[];
      setLines(Array.isArray(parsed) ? parsed : []);
    } catch {
      setLines([]);
    }
  }, [guildId, userId]);

  useEffect(() => {
    if (!guildId || !userId) return;
    localStorage.setItem(storageKey(guildId, userId), JSON.stringify(lines));
  }, [lines, guildId, userId]);

  const addItem = useCallback((product: CartProductSnapshot, qty = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id
            ? { ...l, quantity: Math.min(99, l.quantity + qty), product }
            : l,
        );
      }
      return [...prev, { product, quantity: Math.min(99, Math.max(1, qty)) }];
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    const q = Math.floor(quantity);
    if (q < 1) {
      setLines((prev) => prev.filter((l) => l.product.id !== productId));
      return;
    }
    setLines((prev) =>
      prev.map((l) =>
        l.product.id === productId ? { ...l, quantity: Math.min(99, q) } : l,
      ),
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.product.id !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const { subtotal, hasQuoteItems } = useMemo(() => computeSubtotal(lines), [lines]);
  const itemCount = useMemo(
    () => lines.reduce((acc, l) => acc + l.quantity, 0),
    [lines],
  );

  const value = useMemo(
    () => ({
      lines,
      itemCount,
      subtotal,
      hasQuoteItems,
      addItem,
      setQuantity,
      removeItem,
      clear,
    }),
    [lines, itemCount, subtotal, hasQuoteItems, addItem, setQuantity, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export function formatShopPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return 'Contact for quote';
  return `€${price.toFixed(2)}`;
}
