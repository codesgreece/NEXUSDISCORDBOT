import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { GuildProvider } from './hooks/useGuildSelection';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { ServersPage } from './pages/ServersPage';
import { DashboardHomePage } from './pages/DashboardHomePage';
import { ComingSoonPage } from './pages/ComingSoonPage';

export default function App() {
  return (
    <AuthProvider>
      <GuildProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/servers" replace />} />
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/servers" element={<ServersPage />} />
              <Route path="/app/:guildId" element={<AppLayout />}>
                <Route index element={<DashboardHomePage />} />
                <Route path="overview" element={<DashboardHomePage />} />
                <Route path="channels" element={<ComingSoonPage title="Channels" />} />
                <Route path="roles" element={<ComingSoonPage title="Roles" />} />
                <Route path="members" element={<ComingSoonPage title="Members" />} />
                <Route path="welcome" element={<ComingSoonPage title="Welcome Editor" />} />
                <Route path="rules" element={<ComingSoonPage title="Rules Editor" />} />
                <Route path="services" element={<ComingSoonPage title="Services Editor" />} />
                <Route path="pricing" element={<ComingSoonPage title="Pricing Editor" />} />
                <Route
                  path="tickets/settings"
                  element={<ComingSoonPage title="Ticket Settings" />}
                />
                <Route
                  path="tickets/categories"
                  element={<ComingSoonPage title="Ticket Categories" />}
                />
                <Route
                  path="tickets/messages"
                  element={<ComingSoonPage title="Ticket Messages" />}
                />
                <Route path="bot/general" element={<ComingSoonPage title="Bot General" />} />
                <Route path="bot/status" element={<ComingSoonPage title="Bot Status" />} />
                <Route path="bot/logs" element={<ComingSoonPage title="Logs" />} />
                <Route
                  path="integrations"
                  element={<ComingSoonPage title="Integrations" />}
                />
                <Route path="security" element={<ComingSoonPage title="Security" />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/servers" replace />} />
          </Routes>
        </BrowserRouter>
      </GuildProvider>
    </AuthProvider>
  );
}
