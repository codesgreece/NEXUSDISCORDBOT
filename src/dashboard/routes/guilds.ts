import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getSessionUser } from '../types';
import {
  assertGuildAccess,
  fetchUserGuilds,
  getGuildOverview,
  getManageableGuilds,
  GuildAccessError,
} from '../../services/guildAccessService';
import { listActivity } from '../../db/activityRepository';
import { getClient } from '../../bot/client';

export const guildsRouter = Router();

guildsRouter.use(requireAuth);

guildsRouter.get('/', async (req, res) => {
  try {
    const user = getSessionUser(req)!;
    const userGuilds = await fetchUserGuilds(user.accessToken, { force: true });
    const guilds = await getManageableGuilds(userGuilds, user.id);
    console.log(
      `[API] Guilds for ${user.username}: oauth=${userGuilds.length}, manageable=${guilds.length}, botGuilds=${getClient().guilds.cache.size}`,
    );
    res.json({ guilds });
  } catch (error) {
    console.error('[API] GET /guilds:', error);
    const message = error instanceof Error ? error.message : 'Failed to load guilds';
    const status = message.includes('(429)') ? 429 : 500;
    res.status(status).json({
      error: status === 429
        ? 'Discord rate limit — wait a few seconds and refresh.'
        : 'Failed to load guilds',
    });
  }
});

guildsRouter.get('/:guildId/overview', async (req, res) => {
  try {
    const user = getSessionUser(req)!;
    await assertGuildAccess(user.accessToken, req.params.guildId, user.id);
    const overview = getGuildOverview(req.params.guildId);
    res.json(overview);
  } catch (error) {
    if (error instanceof GuildAccessError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('[API] GET /guilds/:id/overview:', error);
    res.status(500).json({ error: 'Failed to load overview' });
  }
});

guildsRouter.get('/:guildId/activity', async (req, res) => {
  try {
    const user = getSessionUser(req)!;
    await assertGuildAccess(user.accessToken, req.params.guildId, user.id);
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    res.json({ activity: listActivity(req.params.guildId, limit) });
  } catch (error) {
    if (error instanceof GuildAccessError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to load activity' });
  }
});

guildsRouter.get('/:guildId/bot-status', async (req, res) => {
  try {
    const user = getSessionUser(req)!;
    await assertGuildAccess(user.accessToken, req.params.guildId, user.id);
    const client = getClient();
    res.json({
      online: client.isReady(),
      tag: client.user?.tag ?? null,
      ping: client.ws.ping,
      uptimeMs: client.uptime,
      guildCount: client.guilds.cache.size,
    });
  } catch (error) {
    if (error instanceof GuildAccessError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to load bot status' });
  }
});
