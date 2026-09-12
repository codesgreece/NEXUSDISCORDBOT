export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="glass rounded-3xl p-10 text-center">
      <p className="font-display text-2xl font-semibold">{title}</p>
      <p className="mt-3 text-sm text-nexus-muted">
        This module is planned for the next phase. The sidebar and routing are ready.
      </p>
    </div>
  );
}
