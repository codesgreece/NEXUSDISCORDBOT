import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ActivityItem } from '../types';
import { ErrorBanner, LoadingLine, PageHeader, useGuildId } from '../components/ui';

export function BotLogsPage() {
  const guildId = useGuildId();
  const [rows, setRows] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setRows((await api.activity(guildId, 100)).activity);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load logs');
      }
    })();
  }, [guildId]);

  if (!rows.length && !error) return <LoadingLine />;

  return (
    <div>
      <PageHeader title="Logs" subtitle="Dashboard and bot activity history" />
      <ErrorBanner message={error} />
      <div className="space-y-2">
        {rows.map((a) => (
          <div key={a.id} className="glass rounded-xl px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-white">{a.action}</p>
              <p className="text-xs text-nexus-muted">{new Date(a.createdAt).toLocaleString()}</p>
            </div>
            <p className="mt-1 text-xs text-nexus-muted">
              {a.userTag || 'system'}
              {a.details ? ` · ${a.details}` : ''}
            </p>
          </div>
        ))}
        {!rows.length && <p className="text-sm text-nexus-muted">No activity yet.</p>}
      </div>
    </div>
  );
}
