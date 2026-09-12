import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ErrorBanner, LoadingLine, PageHeader, PrimaryButton, useGuildId } from '../components/ui';

export function RolesPage() {
  const guildId = useGuildId();
  const [roles, setRoles] = useState<Awaited<ReturnType<typeof api.roles>>['roles']>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#5865F2');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setError(null);
      setRoles((await api.roles(guildId)).roles);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roles');
    }
  };

  useEffect(() => {
    void load();
  }, [guildId]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.createRole(guildId, { name: name.trim(), color });
      setName('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this role?')) return;
    setBusy(true);
    try {
      await api.deleteRole(guildId, id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  if (!roles.length && !error) return <LoadingLine />;

  return (
    <div>
      <PageHeader title="Roles" subtitle="Create and manage Discord roles" />
      <ErrorBanner message={error} />
      <div className="glass mb-6 flex flex-wrap items-end gap-3 rounded-2xl p-4">
        <label className="flex flex-col gap-1 text-xs text-nexus-muted">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-nexus-muted">
          Color
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-16 rounded-lg border border-white/10 bg-black/30" />
        </label>
        <PrimaryButton disabled={busy || !name.trim()} onClick={() => void create()}>Create role</PrimaryButton>
      </div>
      <div className="space-y-2">
        {roles.map((r) => (
          <div key={r.id} className="glass flex items-center justify-between rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ background: r.color === '#000000' ? '#99aab5' : r.color }} />
              <div>
                <p className="text-sm font-medium text-white">{r.name}</p>
                <p className="text-xs text-nexus-muted">{r.members} members{r.managed ? ' · managed' : ''}</p>
              </div>
            </div>
            {!r.managed && (
              <PrimaryButton variant="danger" disabled={busy} onClick={() => void remove(r.id)}>Delete</PrimaryButton>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
