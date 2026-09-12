import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Hash,
  Shield,
  Users,
  Hand,
  ScrollText,
  Briefcase,
  BadgeDollarSign,
  Settings2,
  Tags,
  MessageSquareText,
  Bot,
  Activity,
  ScrollText as LogsIcon,
  Plug,
  Lock,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface SidebarProps {
  guildId: string;
  onLogout: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-nexus-muted/80">
        {title}
      </p>
      {children}
    </div>
  );
}

function Item({
  to,
  icon: Icon,
  label,
  soon,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  soon?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `nav-link ${isActive ? 'nav-link-active' : ''} ${soon ? 'opacity-60' : ''}`
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {soon && (
        <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-nexus-muted">
          Soon
        </span>
      )}
    </NavLink>
  );
}

export function Sidebar({ guildId, onLogout }: SidebarProps) {
  const { user } = useAuth();
  const base = `/app/${guildId}`;

  return (
    <aside className="flex h-full w-72 flex-col border-r border-white/10 bg-[#0e1118]/80 backdrop-blur-xl">
      <div className="border-b border-white/10 px-5 py-6">
        <p className="font-display text-xl font-bold tracking-tight text-white">NEXUS</p>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-nexus-purple">
          Development
        </p>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        <Item to={base} icon={LayoutDashboard} label="Dashboard" />

        <Section title="Server">
          <Item to={`${base}/overview`} icon={LayoutDashboard} label="Overview" />
          <Item to={`${base}/channels`} icon={Hash} label="Channels" soon />
          <Item to={`${base}/roles`} icon={Shield} label="Roles" soon />
          <Item to={`${base}/members`} icon={Users} label="Members" soon />
        </Section>

        <Section title="Content">
          <Item to={`${base}/welcome`} icon={Hand} label="Welcome" soon />
          <Item to={`${base}/rules`} icon={ScrollText} label="Rules" soon />
          <Item to={`${base}/services`} icon={Briefcase} label="Services" soon />
          <Item to={`${base}/pricing`} icon={BadgeDollarSign} label="Pricing" soon />
        </Section>

        <Section title="Tickets">
          <Item to={`${base}/tickets/settings`} icon={Settings2} label="Settings" soon />
          <Item to={`${base}/tickets/categories`} icon={Tags} label="Categories" soon />
          <Item to={`${base}/tickets/messages`} icon={MessageSquareText} label="Messages" soon />
        </Section>

        <Section title="Bot">
          <Item to={`${base}/bot/general`} icon={Bot} label="General" soon />
          <Item to={`${base}/bot/status`} icon={Activity} label="Status" soon />
          <Item to={`${base}/bot/logs`} icon={LogsIcon} label="Logs" soon />
        </Section>

        <Section title="System">
          <Item to={`${base}/integrations`} icon={Plug} label="Integrations" soon />
          <Item to={`${base}/security`} icon={Lock} label="Security" soon />
        </Section>
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="glass flex items-center gap-3 rounded-2xl p-3">
          <img
            src={user?.avatarUrl}
            alt=""
            className="h-10 w-10 rounded-full ring-2 ring-nexus-purple/40"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {user?.globalName || user?.username}
            </p>
            <p className="truncate text-xs text-nexus-muted">@{user?.username}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl p-2 text-nexus-muted transition hover:bg-white/5 hover:text-white"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
