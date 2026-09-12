import { useParams } from 'react-router-dom';

export function useGuildId() {
  const { guildId = '' } = useParams();
  return guildId;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-nexus-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  );
}

export function LoadingLine({ text = 'Loading…' }: { text?: string }) {
  return <p className="text-sm text-nexus-muted">{text}</p>;
}

export function PrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'ghost' },
) {
  const { variant = 'primary', className = '', ...rest } = props;
  const styles =
    variant === 'danger'
      ? 'border-red-500/40 bg-red-500/15 text-red-200 hover:bg-red-500/25'
      : variant === 'ghost'
        ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
        : 'border-nexus-purple/40 bg-nexus-purple/20 text-white hover:bg-nexus-purple/30';
  return (
    <button
      type="button"
      className={`rounded-xl border px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${styles} ${className}`}
      {...rest}
    />
  );
}
