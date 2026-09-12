import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ErrorBanner, LoadingLine, PageHeader, useGuildId } from '../components/ui';

export function SecurityPage() {
  const guildId = useGuildId();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.security>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setData(await api.security(guildId));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      }
    })();
  }, [guildId]);

  if (!data && !error) return <LoadingLine />;
  if (!data) return <ErrorBanner message={error} />;

  return (
    <div>
      <PageHeader title="Security" subtitle="Access policy and your permissions" />
      <ErrorBanner message={error} />
      <div className="space-y-4">
        <div className="glass rounded-2xl p-5">
          <h2 className="font-display text-lg font-semibold text-white">You</h2>
          <p className="mt-2 text-sm text-white">@{data.you.username} {data.you.isOwner ? '· Owner' : ''}</p>
          <p className="mt-1 text-xs text-nexus-muted">Roles: {data.you.roles.join(', ') || 'none'}</p>
          <p className="mt-2 text-xs text-nexus-muted">Key perms: {data.you.permissions.filter((p) => /Admin|Manage|Kick|Ban|Moderate/i.test(p)).slice(0, 12).join(', ') || '—'}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <h2 className="font-display text-lg font-semibold text-white">Policy</h2>
          <ul className="mt-3 space-y-2 text-sm text-nexus-muted">
            {Object.entries(data.policy).map(([k, v]) => (
              <li key={k}><span className="text-white">{k}:</span> {v}</li>
            ))}
          </ul>
        </div>
        <div className="glass rounded-2xl p-5">
          <h2 className="font-display text-lg font-semibold text-white">Recent admin actions</h2>
          <div className="mt-3 space-y-2">
            {data.recentAdminActions.map((a) => (
              <div key={a.id} className="rounded-xl border border-white/5 px-3 py-2 text-xs text-nexus-muted">
                <span className="text-white">{a.action}</span> · {a.userTag || 'system'} · {new Date(a.createdAt).toLocaleString()}
              </div>
            ))}
            {!data.recentAdminActions.length && <p className="text-sm text-nexus-muted">No admin actions yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
