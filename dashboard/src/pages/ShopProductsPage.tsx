import { useEffect, useState } from 'react';
import { api, type ShopProduct } from '../lib/api';
import { ErrorBanner, LoadingLine, PageHeader, PrimaryButton, useGuildId } from '../components/ui';
import { formatShopPrice } from '../hooks/useCart';

const emptyForm = {
  name: '',
  emoji: '🤖',
  description: '',
  price: '',
  active: true,
};

export function ShopProductsPage() {
  const guildId = useGuildId();
  const [products, setProducts] = useState<ShopProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      const res = await api.shopProductsManage(guildId);
      setProducts(res.products);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    }
  };

  useEffect(() => {
    void load();
  }, [guildId]);

  const startEdit = (p: ShopProduct) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      emoji: p.emoji,
      description: p.description,
      price: p.price === null ? '' : String(p.price),
      active: p.active,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const parsePrice = (): number | null | undefined => {
    if (form.price.trim() === '') return null;
    const n = Number(form.price);
    if (!Number.isFinite(n) || n < 0) throw new Error('Invalid price');
    return Math.round(n * 100) / 100;
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const price = parsePrice();
      if (editingId) {
        await api.updateShopProduct(guildId, editingId, {
          name: form.name.trim(),
          emoji: form.emoji,
          description: form.description,
          price: price ?? null,
          active: form.active,
        });
      } else {
        await api.createShopProduct(guildId, {
          name: form.name.trim(),
          emoji: form.emoji,
          description: form.description,
          price: price ?? null,
          active: form.active,
        });
      }
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (p: ShopProduct) => {
    setBusy(true);
    try {
      await api.updateShopProduct(guildId, p.id, { active: !p.active });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    setBusy(true);
    try {
      await api.deleteShopProduct(guildId, id);
      if (editingId === id) resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  if (!products && !error) return <LoadingLine />;

  return (
    <div>
      <PageHeader
        title="Διαχείριση προϊόντων"
        subtitle="Add · Edit · Price · Description · Enable/Disable · Delete"
      />
      <ErrorBanner message={error} />

      <div className="glass mb-6 grid gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-nexus-muted">
          Name
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-nexus-muted">
          Emoji
          <input
            value={form.emoji}
            onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-nexus-muted">
          Price (€) — άδειο = quote
          <input
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            placeholder="3.99"
          />
        </label>
        <label className="sm:col-span-2 flex flex-col gap-1 text-xs text-nexus-muted">
          Description
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-white">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          />
          Active
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
          <PrimaryButton disabled={busy || !form.name.trim()} onClick={() => void save()}>
            {editingId ? 'Save changes' : 'Add product'}
          </PrimaryButton>
          {editingId && (
            <PrimaryButton variant="ghost" disabled={busy} onClick={resetForm}>
              Cancel edit
            </PrimaryButton>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {(products ?? []).map((p) => (
          <div
            key={p.id}
            className="glass flex flex-col gap-3 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm text-white">
                <span className="mr-2">{p.emoji}</span>
                {p.name}
                {!p.active && (
                  <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-[10px] uppercase text-nexus-muted">
                    disabled
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-nexus-muted">{p.description}</p>
              <p className="mt-1 text-sm text-nexus-blue">{formatShopPrice(p.price)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton variant="ghost" disabled={busy} onClick={() => startEdit(p)}>
                Edit
              </PrimaryButton>
              <PrimaryButton variant="ghost" disabled={busy} onClick={() => void toggleActive(p)}>
                {p.active ? 'Disable' : 'Enable'}
              </PrimaryButton>
              <PrimaryButton variant="danger" disabled={busy} onClick={() => void remove(p.id)}>
                Delete
              </PrimaryButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
