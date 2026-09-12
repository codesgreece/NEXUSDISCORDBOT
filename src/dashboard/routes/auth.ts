import { Router } from 'express';
import { randomBytes } from 'crypto';
import { assertDashboardAuthConfig, config } from '../../config';
import { getAvatarUrl, getSessionUser } from '../types';
import { authLimiter } from '../middleware/rateLimit';
import { requireAuth } from '../middleware/auth';
import { recordActivity } from '../../db/activityRepository';
import { clearGuildCache } from '../../services/guildAccessService';

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface DiscordUserResponse {
  id: string;
  username: string;
  global_name: string | null;
  discriminator: string;
  avatar: string | null;
}

const OAUTH_SCOPES = ['identify', 'guilds'].join(' ');

export const authRouter = Router();

authRouter.get('/discord', authLimiter, (req, res) => {
  try {
    assertDashboardAuthConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth not configured';
    res.status(500).json({ error: message });
    return;
  }

  const state = randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: config.discordClientId,
    redirect_uri: config.discordRedirectUri,
    response_type: 'code',
    scope: OAUTH_SCOPES,
    state,
    prompt: 'consent',
  });

  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

authRouter.get('/callback', authLimiter, async (req, res) => {
  try {
    assertDashboardAuthConfig();

    const code = typeof req.query.code === 'string' ? req.query.code : null;
    const state = typeof req.query.state === 'string' ? req.query.state : null;
    const error = typeof req.query.error === 'string' ? req.query.error : null;

    if (error) {
      res.redirect(`${config.dashboardOrigin}/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code || !state || state !== req.session.oauthState) {
      res.redirect(`${config.dashboardOrigin}/login?error=invalid_state`);
      return;
    }

    delete req.session.oauthState;

    const body = new URLSearchParams({
      client_id: config.discordClientId,
      client_secret: config.discordClientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.discordRedirectUri,
    });

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!tokenRes.ok) {
      console.error('[AUTH] Token exchange failed:', tokenRes.status);
      res.redirect(`${config.dashboardOrigin}/login?error=token_exchange`);
      return;
    }

    const tokenData = (await tokenRes.json()) as DiscordTokenResponse;

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      res.redirect(`${config.dashboardOrigin}/login?error=user_fetch`);
      return;
    }

    const user = (await userRes.json()) as DiscordUserResponse;

    req.session.user = {
      id: user.id,
      username: user.username,
      globalName: user.global_name,
      discriminator: user.discriminator,
      avatar: user.avatar,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
    };

    clearGuildCache();

    recordActivity({
      guildId: config.guildId,
      action: 'User logged in',
      userId: user.id,
      userTag: user.username,
      details: 'Dashboard Discord OAuth login',
    });

    res.redirect(`${config.dashboardOrigin}/servers`);
  } catch (error) {
    console.error('[AUTH] Callback error:', error);
    res.redirect(`${config.dashboardOrigin}/login?error=server_error`);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  const user = getSessionUser(req)!;
  res.json({
    id: user.id,
    username: user.username,
    globalName: user.globalName,
    discriminator: user.discriminator,
    avatarUrl: getAvatarUrl(user),
  });
});

authRouter.post('/logout', requireAuth, (req, res) => {
  const user = getSessionUser(req);
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Failed to logout' });
      return;
    }
    res.clearCookie('nexus.sid');
    if (user) {
      recordActivity({
        guildId: config.guildId,
        action: 'User logged out',
        userId: user.id,
        userTag: user.username,
      });
    }
    res.json({ ok: true });
  });
});

