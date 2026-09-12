import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { ErrorBanner, PageHeader, PrimaryButton, useGuildId } from '../components/ui';
import { formatShopPrice, useCart } from '../hooks/useCart';

export function ShopCartPage() {
  const guildId = useGuildId();
  const navigate = useNavigate();
  const { lines, subtotal, hasQuoteItems, setQuantity, removeItem, clear, itemCount } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState<{ orderId: string; ticketChannelId: string } | null>(
    null,
  );

  const checkout = async () => {
    if (!lines.length) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.shopCheckout(guildId, {
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        notes: notes.trim() || undefined,
      });
      clear();
      setSuccess({
        orderId: result.order.id,
        ticketChannelId: result.ticketChannelId,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setBusy(false);
    }
  };

  if (success) {
    return (
      <div>
        <PageHeader title="Παραγγελία καταχωρήθηκε" subtitle="Έτοιμο για μελλοντική πληρωμή · Discord ticket ανοιχτό" />
        <div className="glass max-w-xl rounded-2xl p-6">
          <p className="text-sm text-nexus-muted">Order ID</p>
          <p className="mt-1 font-mono text-lg font-semibold text-white">{success.orderId}</p>
          <p className="mt-4 text-sm leading-relaxed text-nexus-muted">
            Δημιουργήθηκε Discord ticket για το staff. Δεν έγινε πραγματική χρέωση — το checkout είναι
            έτοιμο για σύνδεση με payment provider αργότερα.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <PrimaryButton onClick={() => navigate(`/app/${guildId}/shop`)}>
              Πίσω στο κατάστημα
            </PrimaryButton>
            <PrimaryButton variant="ghost" onClick={() => navigate(`/app/${guildId}/shop/orders`)}>
              Οι παραγγελίες μου
            </PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Καλάθι"
        subtitle="Έλεγχος προϊόντων και checkout"
        actions={
          <Link
            to={`/app/${guildId}/shop`}
            className="inline-flex items-center gap-2 text-sm text-nexus-muted transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Κατάστημα
          </Link>
        }
      />
      <ErrorBanner message={error} />

      {!lines.length ? (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-nexus-muted">Το καλάθι είναι άδειο.</p>
          <PrimaryButton className="mt-4" onClick={() => navigate(`/app/${guildId}/shop`)}>
            Δες τα bots
          </PrimaryButton>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {lines.map((line) => (
              <div
                key={line.product.id}
                className="glass flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="text-3xl">{line.product.emoji}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{line.product.name}</p>
                    <p className="text-xs text-nexus-muted line-clamp-2">{line.product.description}</p>
                    <p className="mt-1 text-sm text-nexus-blue">
                      {formatShopPrice(line.product.price)}
                      {line.product.price !== null && line.quantity > 1 && (
                        <span className="text-nexus-muted">
                          {' '}
                          · line {formatShopPrice(line.product.price * line.quantity)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-white/10 p-2 text-white hover:bg-white/5"
                    onClick={() => setQuantity(line.product.id, line.quantity - 1)}
                    aria-label="Decrease"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold text-white">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    className="rounded-lg border border-white/10 p-2 text-white hover:bg-white/5"
                    onClick={() => setQuantity(line.product.id, line.quantity + 1)}
                    aria-label="Increase"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="ml-2 rounded-lg border border-red-500/30 p-2 text-red-300 hover:bg-red-500/10"
                    onClick={() => removeItem(line.product.id)}
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <aside className="glass h-fit rounded-2xl p-5 lg:sticky lg:top-24">
            <h2 className="font-display text-lg font-bold text-white">Σύνοψη</h2>
            <p className="mt-1 text-xs text-nexus-muted">{itemCount} προϊόν(τα)</p>
            <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
              <div className="flex justify-between text-nexus-muted">
                <span>Subtotal</span>
                <span>{formatShopPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between font-semibold text-white">
                <span>Σύνολο</span>
                <span className="text-nexus-blue">{formatShopPrice(subtotal)}</span>
              </div>
              {hasQuoteItems && (
                <p className="text-xs text-amber-300/90">
                  Περιλαμβάνει προϊόντα χωρίς τιμή — το staff θα σου δώσει quote στο ticket.
                </p>
              )}
            </div>
            <label className="mt-4 block text-xs text-nexus-muted">
              Σημειώσεις (προαιρετικά)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                placeholder="Server needs, timeline…"
              />
            </label>
            <PrimaryButton
              className="mt-4 w-full"
              disabled={busy || !lines.length}
              onClick={() => void checkout()}
            >
              {busy ? 'Checkout…' : 'Checkout'}
            </PrimaryButton>
            <p className="mt-3 text-[11px] leading-relaxed text-nexus-muted">
              Δεν γίνεται πραγματική πληρωμή. Το checkout δημιουργεί order record και Discord ticket για
              το staff.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
