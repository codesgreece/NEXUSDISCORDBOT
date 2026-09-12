import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ErrorBanner, LoadingLine, PageHeader, PrimaryButton, useGuildId } from '../components/ui';

export function BotGeneralPage() {
  const guildId = useGuildId();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.botGeneral>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setData(await api.botGeneral(guildId));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      }
    })();
  }, [guildId]);

  if (!data && !error) return <LoadingLine />;
  if (!data) return <ErrorBanner message={error} />;

  const save = async () => {
    setBusy(true);
    try {
      const updated = await api.saveBotGeneral(guildId, { logChannelId: data.logChannelId });
      setData({ ...data, logChannelId: updated.logChannelId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Bot General" subtitle="Core bot settings for this server" actions={<PrimaryButton disabled={busy} onClick={() => void save()}>Save</PrimaryButton>} />
      <ErrorBanner message={error} />
      <div className="glass space-y-4 rounded-2xl p-5">
        <p className="text-sm text-white">Bot: <span className="text-nexus-muted">{data.botTag || '—'}</span></p>
        <p className="text-sm text-white">Presence: <span className="text-nexus-muted">{data.presence}</span></p>
        <label className="flex flex-col gap-1 text-xs text-nexus-muted">
          Log channel
          <select
            value={data.logChannelId || ''}
            onChange={(e) => setData({ ...data, logChannelId: e.target.value || null })}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          >
            <option value="">Default (📝・logs)</option>
            {data.textChannels.map((c) => (
              <option key={c.id} value={c.id}>#{c.name}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
