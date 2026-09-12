import { useEffect, useState } from 'react';
import { Hash, Volume2, Folder } from 'lucide-react';
import { api } from '../lib/api';
import { ErrorBanner, LoadingLine, PageHeader, PrimaryButton, useGuildId } from '../components/ui';

export function ChannelsPage() {
  const guildId = useGuildId();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.channels>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'text' | 'voice' | 'category'>('text');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setError(null);
      setData(await api.channels(guildId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load channels');
    }
  };

  useEffect(() => {
    void load();
  }, [guildId]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.createChannel(guildId, { name: name.trim(), type });
      setName('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this channel?')) return;
    setBusy(true);
    try {
      await api.deleteChannel(guildId, id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  if (!data && !error) return <LoadingLine />;

  return (
    <div>
      <PageHeader title="Channels" subtitle="Browse and manage server channels" />
      <ErrorBanner message={error} />

      <div className="glass mb-6 flex flex-wrap items-end gap-3 rounded-2xl p-4">
        <label className="flex flex-col gap-1 text-xs text-nexus-muted">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            placeholder="new-channel"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-nexus-muted">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          >
            <option value="text">Text</option>
            <option value="voice">Voice</option>
            <option value="category">Category</option>
          </select>
        </label>
        <PrimaryButton disabled={busy || !name.trim()} onClick={() => void create()}>
          Create
        </PrimaryButton>
      </div>

      <div className="space-y-6">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-nexus-muted">
            <Folder className="h-4 w-4" /> Categories ({data?.categories.length ?? 0})
          </h2>
          <div className="space-y-2">
            {data?.categories.map((c) => (
              <div key={c.id} className="glass flex items-center justify-between rounded-xl px-4 py-3">
                <span className="text-sm text-white">{c.name}</span>
                <PrimaryButton variant="danger" disabled={busy} onClick={() => void remove(c.id)}>
                  Delete
                </PrimaryButton>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-nexus-muted">
            <Hash className="h-4 w-4" /> Text ({data?.text.length ?? 0})
          </h2>
          <div className="space-y-2">
            {data?.text.map((c) => (
              <div key={c.id} className="glass flex items-center justify-between rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm text-white">#{c.name}</p>
                  {c.topic && <p className="text-xs text-nexus-muted">{c.topic}</p>}
                </div>
                <PrimaryButton variant="danger" disabled={busy} onClick={() => void remove(c.id)}>
                  Delete
                </PrimaryButton>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-nexus-muted">
            <Volume2 className="h-4 w-4" /> Voice ({data?.voice.length ?? 0})
          </h2>
          <div className="space-y-2">
            {data?.voice.map((c) => (
              <div key={c.id} className="glass flex items-center justify-between rounded-xl px-4 py-3">
                <span className="text-sm text-white">{c.name}</span>
                <PrimaryButton variant="danger" disabled={busy} onClick={() => void remove(c.id)}>
                  Delete
                </PrimaryButton>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
