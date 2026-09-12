import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { useGuildSelection } from '../hooks/useGuildSelection';

export function AppLayout() {
  const { guildId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { setSelectedGuildId } = useGuildSelection();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (guildId) setSelectedGuildId(guildId);
  }, [guildId, setSelectedGuildId]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    setMobileOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen">
      <div className="sticky top-0 hidden h-screen lg:block">
        <Sidebar guildId={guildId} onLogout={() => void handleLogout()} />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex h-full w-[min(20rem,88vw)] shadow-2xl">
            <Sidebar
              guildId={guildId}
              onLogout={() => void handleLogout()}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <main className="flex-1 overflow-x-hidden">
        <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[#0b0d12]/90 px-4 py-3 backdrop-blur-xl lg:hidden">
          <p className="font-display text-lg font-bold">NEXUS</p>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
