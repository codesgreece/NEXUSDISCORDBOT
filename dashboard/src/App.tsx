import { BrowserRouter, Navigate, Route, Routes, Outlet } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { GuildProvider } from './hooks/useGuildSelection';
import { CartProvider } from './hooks/useCart';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { ServersPage } from './pages/ServersPage';
import { DashboardHomePage } from './pages/DashboardHomePage';
import { ChannelsPage } from './pages/ChannelsPage';
import { RolesPage } from './pages/RolesPage';
import { MembersPage } from './pages/MembersPage';
import { EmbedEditorPage } from './pages/EmbedEditorPage';
import { TicketSettingsPage } from './pages/TicketSettingsPage';
import { TicketCategoriesPage } from './pages/TicketCategoriesPage';
import { BotGeneralPage } from './pages/BotGeneralPage';
import { BotStatusPage } from './pages/BotStatusPage';
import { BotLogsPage } from './pages/BotLogsPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { SecurityPage } from './pages/SecurityPage';
import { ShopPage } from './pages/ShopPage';
import { ShopCartPage } from './pages/ShopCartPage';
import { ShopOrdersPage } from './pages/ShopOrdersPage';
import { ShopProductsPage } from './pages/ShopProductsPage';

function ShopLayout() {
  return (
    <CartProvider>
      <Outlet />
    </CartProvider>
  );
}

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
                <Route path="channels" element={<ChannelsPage />} />
                <Route path="roles" element={<RolesPage />} />
                <Route path="members" element={<MembersPage />} />
                <Route path="welcome" element={<EmbedEditorPage kind="welcome" />} />
                <Route path="rules" element={<EmbedEditorPage kind="rules" />} />
                <Route path="services" element={<EmbedEditorPage kind="services" />} />
                <Route path="pricing" element={<EmbedEditorPage kind="pricing" />} />
                <Route path="tickets/settings" element={<TicketSettingsPage />} />
                <Route path="tickets/categories" element={<TicketCategoriesPage />} />
                <Route path="tickets/messages" element={<EmbedEditorPage kind="ticket" />} />
                <Route path="bot/general" element={<BotGeneralPage />} />
                <Route path="bot/status" element={<BotStatusPage />} />
                <Route path="bot/logs" element={<BotLogsPage />} />
                <Route path="integrations" element={<IntegrationsPage />} />
                <Route path="security" element={<SecurityPage />} />
                <Route path="shop" element={<ShopLayout />}>
                  <Route index element={<ShopPage />} />
                  <Route path="cart" element={<ShopCartPage />} />
                  <Route path="orders" element={<ShopOrdersPage />} />
                  <Route path="products" element={<ShopProductsPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/servers" replace />} />
          </Routes>
        </BrowserRouter>
      </GuildProvider>
    </AuthProvider>
  );
}
