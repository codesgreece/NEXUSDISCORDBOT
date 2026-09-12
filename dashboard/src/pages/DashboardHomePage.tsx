import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Hash,
  Shield,
  Ticket,
  Users,
  Circle,
} from 'lucide-react';
import { api } from '../lib/api';
import type { GuildOverview } from '../types';

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="stat-card">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.16em] text-nexus-muted">{label}</p>
        <Icon className="h-4 w-4 text-nexus-purple" />
      </div>
      <p className="font-display text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

export function DashboardHomePage() {
  const { guildId = '' } = useParams();
  const [overview, setOverview] = useState<GuildOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const data = await api.overview(guildId);
        setOverview(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, [guildId]);

  if (loading) {
    return <p className="text-nexus-muted">Loading dashboard…</p>;
  }

  if (error || !overview) {
    return (
      <div className="rounded-2xl border border-nexus-danger/30 bg-nexus-danger/10 p-5 text-sm text-nexus-danger">
        {error || 'Unable to load overview'}
        <div className="mt-3">
          <Link to="/servers" className="text-nexus-purple underline">
            Choose another server
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="glass rounded-3xl p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="font-display text-4xl font-bold tracking-tight">NEXUS | DEVELOPMENT</p>
            <p className="mt-2 text-sm text-nexus-muted">Premium Discord management dashboard</p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <Circle
                  className={`h-2.5 w-2.5 fill-current ${
                    overview.botStatus === 'online' ? 'text-nexus-success' : 'text-nexus-danger'
                  }`}
                />
                Bot Status{' '}
                <strong className="text-white">
                  {overview.botStatus === 'online' ? 'Online' : 'Offline'}
                </strong>
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                Server <strong className="text-white">{overview.name}</strong>
              </span>
            </div>
          </div>
          {overview.iconUrl && (
            <img
              src={overview.iconUrl}
              alt=""
              className="h-20 w-20 rounded-3xl ring-2 ring-nexus-purple/30"
            />
          )}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Members" value={overview.memberCount} icon={Users} />
        <Stat label="Channels" value={overview.channelCount} icon={Hash} />
        <Stat label="Roles" value={overview.roleCount} icon={Shield} />
        <Stat label="Open Tickets" value={overview.openTickets} icon={Ticket} />
      </section>

      <section className="glass rounded-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Recent Activity</h2>
          <Link to={`/app/${guildId}/bot/logs`} className="text-sm text-nexus-purple">
            View logs
          </Link>
        </div>
        <div className="space-y-3">
          {overview.recentActivity.length === 0 && (
            <p className="text-sm text-nexus-muted">No activity recorded yet.</p>
          )}
          {overview.recentActivity.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/5 bg-black/20 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-white">{item.action}</p>
                {item.details && (
                  <p className="mt-1 max-w-2xl text-xs text-nexus-muted line-clamp-2">
                    {item.details}
                  </p>
                )}
                {item.userTag && (
                  <p className="mt-1 text-xs text-nexus-muted">by {item.userTag}</p>
                )}
              </div>
              <time className="text-xs text-nexus-muted">
                {new Date(item.createdAt).toLocaleString()}
              </time>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
