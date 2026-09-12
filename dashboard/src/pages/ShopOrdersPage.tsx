import { useEffect, useState } from 'react';
import { api, type ShopOrder } from '../lib/api';
import { ErrorBanner, LoadingLine, PageHeader, PrimaryButton, useGuildId } from '../components/ui';
import { formatShopPrice } from '../hooks/useCart';

export function ShopOrdersPage() {
  const guildId = useGuildId();
  const [orders, setOrders] = useState<ShopOrder[] | null>(null);
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [error, setError] = useState<string | null>(null);

  const load = async (nextScope: 'mine' | 'all') => {
    try {
      setError(null);
      const res = await api.shopOrders(guildId, nextScope);
      setOrders(res.orders);
      setScope(nextScope);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    }
  };

  useEffect(() => {
    void load('mine');
  }, [guildId]);

  if (!orders && !error) return <LoadingLine />;

  return (
    <div>
      <PageHeader
        title="Παραγγελίες"
        subtitle="Παραγγελίες Bot Shop — συνδεδεμένες με Discord tickets"
        actions={
          <div className="flex gap-2">
            <PrimaryButton
              variant={scope === 'mine' ? 'primary' : 'ghost'}
              onClick={() => void load('mine')}
            >
              Δικές μου
            </PrimaryButton>
            <PrimaryButton
              variant={scope === 'all' ? 'primary' : 'ghost'}
              onClick={() => void load('all')}
            >
              Όλες (staff)
            </PrimaryButton>
          </div>
        }
      />
      <ErrorBanner message={error} />

      <div className="space-y-3">
        {(orders ?? []).map((order) => (
          <article key={order.id} className="glass rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold text-white">{order.id}</p>
                <p className="mt-1 text-xs text-nexus-muted">
                  {new Date(order.createdAt).toLocaleString()} · {order.userTag} ·{' '}
                  <span className="uppercase tracking-wide text-nexus-purple">{order.status}</span>
                </p>
              </div>
              <p className="font-display text-lg font-semibold text-nexus-blue">
                {formatShopPrice(order.total)}
              </p>
            </div>
            <ul className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-sm text-nexus-muted">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span>
                    {item.productEmoji} {item.productName} × {item.quantity}
                  </span>
                  <span className="text-white/80">{formatShopPrice(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            {order.ticketChannelId && (
              <p className="mt-3 text-xs text-nexus-muted">
                Discord ticket channel: <code className="text-white/70">{order.ticketChannelId}</code>
              </p>
            )}
          </article>
        ))}
        {!orders?.length && !error && (
          <p className="text-sm text-nexus-muted">Δεν υπάρχουν παραγγελίες ακόμα.</p>
        )}
      </div>
    </div>
  );
}
