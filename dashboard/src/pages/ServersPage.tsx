import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Server, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api';
import type { GuildSummary } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useGuildSelection } from '../hooks/useGuildSelection';

export function ServersPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { setSelectedGuildId } = useGuildSelection();
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.guilds();
        setGuilds(data.guilds);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load servers');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectGuild = (guild: GuildSummary) => {
    if (!guild.botInGuild) return;
    setSelectedGuildId(guild.id);
    navigate(`/app/${guild.id}`);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-3xl font-bold">Select a server</p>
          <p className="mt-2 text-sm text-nexus-muted">
            Signed in as {user?.globalName || user?.username}. Choose a guild the bot is in.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout().then(() => navigate('/login'))}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-nexus-muted transition hover:bg-white/5 hover:text-white"
        >
          Logout
        </button>
      </div>

      {loading && <p className="text-nexus-muted">Loading servers…</p>}
      {error && (
        <div className="rounded-2xl border border-nexus-danger/30 bg-nexus-danger/10 p-4 text-sm text-nexus-danger">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-4 sm:grid-cols-2">
          {guilds.map((guild) => {
            const selectable = guild.botInGuild;
            return (
              <button
                key={guild.id}
                type="button"
                onClick={() => selectGuild(guild)}
                disabled={!selectable}
                className={`glass rounded-2xl p-5 text-left transition ${
                  selectable
                    ? 'hover:border-nexus-purple/50 hover:shadow-glow'
                    : 'cursor-not-allowed opacity-70'
                }`}
              >
                <div className="flex items-center gap-4">
                  {guild.iconUrl ? (
                    <img src={guild.iconUrl} alt="" className="h-14 w-14 rounded-2xl" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
                      <Server className="h-6 w-6 text-nexus-muted" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-semibold">{guild.name}</p>
                    <p className="mt-1 text-xs text-nexus-muted">
                      {!guild.botInGuild
                        ? 'Invite the bot to this server first'
                        : guild.canManage
                          ? 'Bot connected — click to open'
                          : 'Open dashboard (read-only — grant Admin to edit)'}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

          {guilds.length === 0 && (
            <div className="glass col-span-full rounded-2xl p-8 text-center">
              <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-nexus-muted" />
              <p className="font-medium">No servers found</p>
              <p className="mt-2 text-sm text-nexus-muted">
                Login with a Discord account that is in a server together with the bot.
              </p>
              <Link to="/login" className="mt-4 inline-block text-sm text-nexus-purple">
                Back to login
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
