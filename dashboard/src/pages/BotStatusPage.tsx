import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ErrorBanner, LoadingLine, PageHeader, useGuildId } from '../components/ui';

function formatUptime(ms: number | null) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

export function BotStatusPage() {
  const guildId = useGuildId();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.botStatus>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setData(await api.botStatus(guildId));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load status');
      }
    })();
  }, [guildId]);

  if (!data && !error) return <LoadingLine />;
  if (!data) return <ErrorBanner message={error} />;

  return (
    <div>
      <PageHeader title="Bot Status" subtitle="Live connection health" />
      <ErrorBanner message={error} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Status" value={data.online ? 'Online' : 'Offline'} />
        <Stat label="Tag" value={data.tag || '—'} />
        <Stat label="Ping" value={`${data.ping}ms`} />
        <Stat label="Uptime" value={formatUptime(data.uptimeMs)} />
        <Stat label="Guilds" value={String(data.guildCount)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wider text-nexus-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
