import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ErrorBanner, LoadingLine, PageHeader, useGuildId } from '../components/ui';

export function IntegrationsPage() {
  const guildId = useGuildId();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.integrations>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setData(await api.integrations(guildId));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      }
    })();
  }, [guildId]);

  if (!data && !error) return <LoadingLine />;
  if (!data) return <ErrorBanner message={error} />;

  return (
    <div>
      <PageHeader title="Integrations" subtitle="Connected platforms and hooks" />
      <ErrorBanner message={error} />
      <div className="space-y-4">
        <div className="glass rounded-2xl p-5">
          <h2 className="font-display text-lg font-semibold text-white">Discord</h2>
          <p className="mt-2 text-sm text-nexus-muted">
            {data.discord.connected ? `Connected to ${data.discord.guildName}` : 'Bot not in guild'}
          </p>
          <p className="mt-1 text-sm text-white">{data.discord.botTag}</p>
          <a className="mt-3 inline-block text-sm text-nexus-purple underline" href={data.discord.inviteHint} target="_blank" rel="noreferrer">
            Bot invite link
          </a>
        </div>
        <div className="glass rounded-2xl p-5">
          <h2 className="font-display text-lg font-semibold text-white">Webhooks</h2>
          <p className="mt-2 text-sm text-nexus-muted">{data.webhooks.note}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <h2 className="font-display text-lg font-semibold text-white">OAuth</h2>
          <p className="mt-2 text-sm text-nexus-muted">Scopes: {data.oauth.scopes.join(', ')}</p>
          <p className="mt-1 text-sm text-nexus-muted">Origin: {data.oauth.dashboardOrigin || '—'}</p>
        </div>
      </div>
    </div>
  );
}
