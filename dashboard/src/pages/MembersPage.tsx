import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ErrorBanner, LoadingLine, PageHeader, PrimaryButton, useGuildId } from '../components/ui';

export function MembersPage() {
  const guildId = useGuildId();
  const [members, setMembers] = useState<Awaited<ReturnType<typeof api.members>>['members']>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async (query?: string) => {
    try {
      setError(null);
      setLoading(true);
      setMembers((await api.members(guildId, query)).members);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [guildId]);

  const timeout = async (id: string, minutes: number) => {
    setBusy(true);
    try {
      await api.timeoutMember(guildId, id, minutes);
      await load(q || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Timeout failed');
    } finally {
      setBusy(false);
    }
  };

  const kick = async (id: string) => {
    if (!confirm('Kick this member?')) return;
    setBusy(true);
    try {
      await api.kickMember(guildId, id);
      await load(q || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kick failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Members" subtitle="Search and moderate server members" />
      <ErrorBanner message={error} />
      <form
        className="glass mb-6 flex gap-2 rounded-2xl p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void load(q || undefined);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search username…"
          className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
        />
        <PrimaryButton type="submit">Search</PrimaryButton>
      </form>
      {loading ? (
        <LoadingLine />
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <img src={m.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
                <div>
                  <p className="text-sm font-medium text-white">
                    {m.displayName} {m.bot && <span className="text-xs text-nexus-muted">BOT</span>}
                  </p>
                  <p className="text-xs text-nexus-muted">@{m.username}</p>
                </div>
              </div>
              {!m.bot && (
                <div className="flex flex-wrap gap-2">
                  <PrimaryButton variant="ghost" disabled={busy} onClick={() => void timeout(m.id, 10)}>Timeout 10m</PrimaryButton>
                  <PrimaryButton variant="ghost" disabled={busy} onClick={() => void timeout(m.id, 0)}>Clear</PrimaryButton>
                  <PrimaryButton variant="danger" disabled={busy} onClick={() => void kick(m.id)}>Kick</PrimaryButton>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
