import { useEffect, useState } from 'react';
import { api, type EmbedKind, type EmbedPayload } from '../lib/api';
import { ErrorBanner, LoadingLine, PageHeader, PrimaryButton, useGuildId } from '../components/ui';

const TITLES: Record<EmbedKind, string> = {
  welcome: 'Welcome Editor',
  rules: 'Rules Editor',
  services: 'Services Editor',
  pricing: 'Pricing Editor',
  ticket: 'Ticket Messages',
};

export function EmbedEditorPage({ kind }: { kind: EmbedKind }) {
  const guildId = useGuildId();
  const [payload, setPayload] = useState<EmbedPayload | null>(null);
  const [meta, setMeta] = useState<{ channelName: string; channelId: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setError(null);
        const data = await api.embed(guildId, kind);
        setPayload(data.payload);
        setMeta({ channelName: data.channelName, channelId: data.channelId });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load embed');
      }
    })();
  }, [guildId, kind]);

  const save = async () => {
    if (!payload) return;
    setBusy(true);
    setSaved(false);
    try {
      await api.saveEmbed(guildId, kind, payload);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  if (!payload && !error) return <LoadingLine />;
  if (!payload) return <ErrorBanner message={error} />;

  return (
    <div>
      <PageHeader
        title={TITLES[kind]}
        subtitle={meta ? `Publishes to #${meta.channelName}` : undefined}
        actions={
          <PrimaryButton disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save & Publish'}
          </PrimaryButton>
        }
      />
      <ErrorBanner message={error} />
      {saved && (
        <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Published to Discord.
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass space-y-4 rounded-2xl p-4">
          <Field label="Title" value={payload.title || ''} onChange={(v) => setPayload({ ...payload, title: v })} />
          <label className="flex flex-col gap-1 text-xs text-nexus-muted">
            Description
            <textarea
              rows={8}
              value={payload.description || ''}
              onChange={(e) => setPayload({ ...payload, description: e.target.value })}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </label>
          <Field label="Color" value={payload.color || '#5865F2'} onChange={(v) => setPayload({ ...payload, color: v })} />
          <Field label="Footer" value={payload.footerText || ''} onChange={(v) => setPayload({ ...payload, footerText: v })} />
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={Boolean(payload.timestamp)}
              onChange={(e) => setPayload({ ...payload, timestamp: e.target.checked })}
            />
            Show timestamp
          </label>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="mb-3 text-xs uppercase tracking-wider text-nexus-muted">Preview</p>
          <div
            className="rounded-xl border-l-4 bg-[#1e1f22] p-4"
            style={{ borderLeftColor: payload.color || '#5865F2' }}
          >
            {payload.title && <p className="mb-2 font-semibold text-white">{payload.title}</p>}
            <p className="whitespace-pre-wrap text-sm text-zinc-300">{payload.description}</p>
            {payload.footerText && <p className="mt-3 text-xs text-zinc-500">{payload.footerText}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-nexus-muted">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
      />
    </label>
  );
}
