import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ErrorBanner, LoadingLine, PageHeader, PrimaryButton, useGuildId } from '../components/ui';

export function TicketSettingsPage() {
  const guildId = useGuildId();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.ticketSettings>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setData(await api.ticketSettings(guildId));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load settings');
      }
    })();
  }, [guildId]);

  if (!data && !error) return <LoadingLine />;
  if (!data) return <ErrorBanner message={error} />;

  const save = async () => {
    setBusy(true);
    setSaved(false);
    try {
      const updated = await api.saveTicketSettings(guildId, {
        ticketsEnabled: data.ticketsEnabled,
        ticketCategoryId: data.ticketCategoryId,
        logChannelId: data.logChannelId,
        staffRoleIds: data.staffRoleIds,
      });
      setData({
        ...data,
        ticketsEnabled: updated.ticketsEnabled,
        ticketCategoryId: updated.ticketCategoryId,
        logChannelId: updated.logChannelId,
        staffRoleIds: updated.staffRoleIds,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleRole = (id: string) => {
    setData({
      ...data,
      staffRoleIds: data.staffRoleIds.includes(id)
        ? data.staffRoleIds.filter((r) => r !== id)
        : [...data.staffRoleIds, id],
    });
  };

  return (
    <div>
      <PageHeader
        title="Ticket Settings"
        subtitle="Enable tickets and choose staff access"
        actions={<PrimaryButton disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</PrimaryButton>}
      />
      <ErrorBanner message={error} />
      {saved && <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">Saved.</div>}
      <div className="glass space-y-5 rounded-2xl p-5">
        <label className="flex items-center justify-between gap-4 text-sm text-white">
          <span>Tickets enabled</span>
          <input type="checkbox" checked={data.ticketsEnabled} onChange={(e) => setData({ ...data, ticketsEnabled: e.target.checked })} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-nexus-muted">
          Ticket category
          <select
            value={data.ticketCategoryId || ''}
            onChange={(e) => setData({ ...data, ticketCategoryId: e.target.value || null })}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          >
            <option value="">Auto-detect</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-nexus-muted">Staff roles</p>
          <div className="flex flex-wrap gap-2">
            {data.roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleRole(r.id)}
                className={`rounded-full border px-3 py-1 text-xs ${data.staffRoleIds.includes(r.id) ? 'border-nexus-purple bg-nexus-purple/20 text-white' : 'border-white/10 text-nexus-muted'}`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
