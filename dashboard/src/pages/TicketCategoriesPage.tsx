import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ErrorBanner, LoadingLine, PageHeader, PrimaryButton, useGuildId } from '../components/ui';

type Cat = { id: string; label: string; emoji: string; enabled?: boolean };

export function TicketCategoriesPage() {
  const guildId = useGuildId();
  const [categories, setCategories] = useState<Cat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.ticketCategories(guildId);
        setCategories(data.categories as Cat[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      }
    })();
  }, [guildId]);

  if (!categories.length && !error) return <LoadingLine />;

  const save = async () => {
    setBusy(true);
    try {
      const res = await api.saveTicketCategories(guildId, categories);
      setCategories(res.categories as Cat[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Ticket Categories" subtitle="Configure panel button categories" actions={<PrimaryButton disabled={busy} onClick={() => void save()}>Save</PrimaryButton>} />
      <ErrorBanner message={error} />
      <div className="space-y-3">
        {categories.map((c, idx) => (
          <div key={c.id} className="glass flex flex-wrap items-center gap-3 rounded-xl p-4">
            <input
              value={c.emoji}
              onChange={(e) => {
                const next = [...categories];
                next[idx] = { ...c, emoji: e.target.value };
                setCategories(next);
              }}
              className="w-16 rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-center text-sm text-white"
            />
            <input
              value={c.label}
              onChange={(e) => {
                const next = [...categories];
                next[idx] = { ...c, label: e.target.value };
                setCategories(next);
              }}
              className="min-w-[10rem] flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
            <label className="flex items-center gap-2 text-xs text-nexus-muted">
              <input
                type="checkbox"
                checked={c.enabled !== false}
                onChange={(e) => {
                  const next = [...categories];
                  next[idx] = { ...c, enabled: e.target.checked };
                  setCategories(next);
                }}
              />
              Enabled
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
