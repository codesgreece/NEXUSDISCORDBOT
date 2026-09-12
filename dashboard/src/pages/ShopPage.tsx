import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Plus, Check } from 'lucide-react';
import { api, type ShopProduct } from '../lib/api';
import { ErrorBanner, LoadingLine, PageHeader, PrimaryButton, useGuildId } from '../components/ui';
import { formatShopPrice, useCart } from '../hooks/useCart';

export function ShopPage() {
  const guildId = useGuildId();
  const { addItem, itemCount } = useCart();
  const [products, setProducts] = useState<ShopProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const res = await api.shopProducts(guildId);
        if (!cancelled) setProducts(res.products);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load shop');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guildId]);

  const onAdd = (product: ShopProduct) => {
    addItem({
      id: product.id,
      name: product.name,
      emoji: product.emoji,
      description: product.description,
      price: product.price,
    });
    setAddedId(product.id);
    window.setTimeout(() => setAddedId((id) => (id === product.id ? null : id)), 1200);
  };

  if (!products && !error) return <LoadingLine />;

  return (
    <div>
      <PageHeader
        title="Κατάστημα Bots"
        subtitle="Premium Discord bots για το server σου — πρόσθεσε στο καλάθι και κάνε checkout"
        actions={
          <Link
            to={`/app/${guildId}/shop/cart`}
            className="inline-flex items-center gap-2 rounded-xl border border-nexus-purple/40 bg-nexus-purple/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-nexus-purple/30"
          >
            <ShoppingCart className="h-4 w-4" />
            Καλάθι
            {itemCount > 0 && (
              <span className="rounded-lg bg-white/15 px-2 py-0.5 text-xs font-semibold">
                {itemCount}
              </span>
            )}
          </Link>
        }
      />
      <ErrorBanner message={error} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(products ?? []).map((product) => {
          const isQuote = product.price === null;
          const justAdded = addedId === product.id;
          return (
            <article
              key={product.id}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5 shadow-glow transition duration-300 hover:-translate-y-1 hover:border-nexus-purple/50 hover:shadow-[0_0_40px_rgba(124,92,255,0.15)]"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-nexus-purple/20 blur-2xl transition group-hover:bg-nexus-blue/25" />
              <div className="relative flex items-start gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-3xl transition group-hover:scale-105">
                  {product.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-bold text-white">{product.name}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-nexus-muted">
                    {product.description}
                  </p>
                </div>
              </div>
              <div className="relative mt-5 flex items-center justify-between gap-3">
                <p
                  className={`font-display text-xl font-semibold ${
                    isQuote ? 'text-amber-300' : 'text-nexus-blue'
                  }`}
                >
                  {formatShopPrice(product.price)}
                </p>
                <PrimaryButton
                  onClick={() => onAdd(product)}
                  className="inline-flex items-center gap-2"
                >
                  {justAdded ? (
                    <>
                      <Check className="h-4 w-4" /> Προστέθηκε
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" /> Προσθήκη στο καλάθι
                    </>
                  )}
                </PrimaryButton>
              </div>
            </article>
          );
        })}
      </div>

      {!products?.length && !error && (
        <p className="mt-6 text-sm text-nexus-muted">Δεν υπάρχουν ενεργά προϊόντα αυτή τη στιγμή.</p>
      )}
    </div>
  );
}
