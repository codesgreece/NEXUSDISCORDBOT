import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { useGuildSelection } from '../hooks/useGuildSelection';
import { useEffect } from 'react';

export function AppLayout() {
  const { guildId = '' } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { setSelectedGuildId } = useGuildSelection();

  useEffect(() => {
    if (guildId) setSelectedGuildId(guildId);
  }, [guildId, setSelectedGuildId]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen">
      <div className="sticky top-0 hidden h-screen lg:block">
        <Sidebar guildId={guildId} onLogout={() => void handleLogout()} />
      </div>
      <main className="flex-1 overflow-x-hidden">
        <div className="border-b border-white/10 bg-black/20 px-4 py-3 lg:hidden">
          <p className="font-display text-lg font-bold">NEXUS</p>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
