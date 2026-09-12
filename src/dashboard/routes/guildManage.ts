import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getSessionUser } from '../types';
import {
  assertGuildAccess,
  assertGuildManage,
  GuildAccessError,
} from '../../services/guildAccessService';
import {
  createChannel,
  deleteChannel,
  listChannels,
  updateChannel,
} from '../../services/channelService';
import {
  createRole,
  deleteRole,
  listRoles,
  updateRole,
} from '../../services/roleService';
import { kickMember, listMembers, timeoutMember } from '../../services/memberService';
import {
  getEmbedState,
  saveEmbedToDiscord,
  type EmbedKind,
  type EmbedPayload,
} from '../../services/embedEditorService';
import { getGuildConfig, updateGuildConfig } from '../../db/guildConfigRepository';
import { getClient } from '../../bot/client';
import { TICKET_TYPES } from '../../config/serverStructure';
import { listActivity } from '../../db/activityRepository';

export const guildManageRouter = Router({ mergeParams: true });

guildManageRouter.use(requireAuth);

type GuildReq = import('express').Request & {
  params: { guildId: string; channelId?: string; roleId?: string; userId?: string; kind?: string };
};

function gid(req: import('express').Request): string {
  return (req.params as { guildId: string }).guildId;
}

async function withAccess(req: import('express').Request, manage: boolean) {
  const user = getSessionUser(req)!;
  if (manage) {
    await assertGuildManage(user.accessToken, gid(req), user.id);
  } else {
    await assertGuildAccess(user.accessToken, gid(req), user.id);
  }
}

function handleError(res: import('express').Response, error: unknown, fallback: string) {
  if (error instanceof GuildAccessError) {
    res.status(error.status ?? 403).json({ error: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : fallback;
  console.error('[API]', fallback, error);
  res.status(400).json({ error: message || fallback });
}

// —— Channels ——
guildManageRouter.get('/channels', async (req, res) => {
  try {
    await withAccess(req, false);
    res.json(listChannels(gid(req)));
  } catch (error) {
    handleError(res, error, 'Failed to list channels');
  }
});

guildManageRouter.post('/channels', async (req, res) => {
  try {
    await withAccess(req, true);
    const user = getSessionUser(req)!;
    const created = await createChannel(gid(req), req.body, {
      id: user.id,
      tag: user.username,
    });
    res.status(201).json(created);
  } catch (error) {
    handleError(res, error, 'Failed to create channel');
  }
});

guildManageRouter.patch('/channels/:channelId', async (req, res) => {
  try {
    await withAccess(req, true);
    const user = getSessionUser(req)!;
    const updated = await updateChannel(gid(req), req.params.channelId, req.body, {
      id: user.id,
      tag: user.username,
    });
    res.json(updated);
  } catch (error) {
    handleError(res, error, 'Failed to update channel');
  }
});

guildManageRouter.delete('/channels/:channelId', async (req, res) => {
  try {
    await withAccess(req, true);
    const user = getSessionUser(req)!;
    res.json(
      await deleteChannel(gid(req), req.params.channelId, {
        id: user.id,
        tag: user.username,
      }),
    );
  } catch (error) {
    handleError(res, error, 'Failed to delete channel');
  }
});

// —— Roles ——
guildManageRouter.get('/roles', async (req, res) => {
  try {
    await withAccess(req, false);
    res.json({ roles: listRoles(gid(req)) });
  } catch (error) {
    handleError(res, error, 'Failed to list roles');
  }
});

guildManageRouter.post('/roles', async (req, res) => {
  try {
    await withAccess(req, true);
    const user = getSessionUser(req)!;
    res.status(201).json(
      await createRole(gid(req), req.body, { id: user.id, tag: user.username }),
    );
  } catch (error) {
    handleError(res, error, 'Failed to create role');
  }
});

guildManageRouter.patch('/roles/:roleId', async (req, res) => {
  try {
    await withAccess(req, true);
    const user = getSessionUser(req)!;
    res.json(
      await updateRole(gid(req), req.params.roleId, req.body, {
        id: user.id,
        tag: user.username,
      }),
    );
  } catch (error) {
    handleError(res, error, 'Failed to update role');
  }
});

guildManageRouter.delete('/roles/:roleId', async (req, res) => {
  try {
    await withAccess(req, true);
    const user = getSessionUser(req)!;
    res.json(
      await deleteRole(gid(req), req.params.roleId, {
        id: user.id,
        tag: user.username,
      }),
    );
  } catch (error) {
    handleError(res, error, 'Failed to delete role');
  }
});

// —— Members ——
guildManageRouter.get('/members', async (req, res) => {
  try {
    await withAccess(req, false);
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    res.json({ members: await listMembers(gid(req), q) });
  } catch (error) {
    handleError(res, error, 'Failed to list members');
  }
});

guildManageRouter.post('/members/:userId/timeout', async (req, res) => {
  try {
    await withAccess(req, true);
    const user = getSessionUser(req)!;
    const minutes = Number(req.body?.minutes ?? 0);
    res.json(
      await timeoutMember(gid(req), req.params.userId, minutes, {
        id: user.id,
        tag: user.username,
      }),
    );
  } catch (error) {
    handleError(res, error, 'Failed to timeout member');
  }
});

guildManageRouter.post('/members/:userId/kick', async (req, res) => {
  try {
    await withAccess(req, true);
    const user = getSessionUser(req)!;
    res.json(
      await kickMember(gid(req), req.params.userId, {
        id: user.id,
        tag: user.username,
      }),
    );
  } catch (error) {
    handleError(res, error, 'Failed to kick member');
  }
});

// —— Embeds ——
const EMBED_KINDS: EmbedKind[] = ['welcome', 'rules', 'services', 'pricing', 'ticket'];

guildManageRouter.get('/embeds/:kind', async (req, res) => {
  try {
    await withAccess(req, false);
    const kind = req.params.kind as EmbedKind;
    if (!EMBED_KINDS.includes(kind)) {
      res.status(400).json({ error: 'Invalid embed kind' });
      return;
    }
    res.json(await getEmbedState(gid(req), kind));
  } catch (error) {
    handleError(res, error, 'Failed to load embed');
  }
});

guildManageRouter.put('/embeds/:kind', async (req, res) => {
  try {
    await withAccess(req, true);
    const kind = req.params.kind as EmbedKind;
    if (!EMBED_KINDS.includes(kind)) {
      res.status(400).json({ error: 'Invalid embed kind' });
      return;
    }
    const user = getSessionUser(req)!;
    const payload = req.body?.payload as EmbedPayload;
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Missing payload' });
      return;
    }
    res.json(
      await saveEmbedToDiscord(gid(req), kind, payload, {
        id: user.id,
        tag: user.username,
      }),
    );
  } catch (error) {
    handleError(res, error, 'Failed to save embed');
  }
});

// —— Ticket settings ——
guildManageRouter.get('/tickets/settings', async (req, res) => {
  try {
    await withAccess(req, false);
    const config = getGuildConfig(gid(req));
    const guild = getClient().guilds.cache.get(gid(req));
    const categories = guild
      ? [...guild.channels.cache.values()]
          .filter((c) => c.type === 4)
          .map((c) => ({ id: c.id, name: c.name }))
      : [];
    const roles = guild
      ? [...guild.roles.cache.values()]
          .filter((r) => r.id !== guild.id)
          .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }))
          .sort((a, b) => b.name.localeCompare(a.name))
      : [];

    res.json({
      ticketsEnabled: config.ticketsEnabled,
      ticketCategoryId: config.ticketCategoryId,
      logChannelId: config.logChannelId,
      staffRoleIds: config.staffRoleIds,
      categories,
      roles,
    });
  } catch (error) {
    handleError(res, error, 'Failed to load ticket settings');
  }
});

guildManageRouter.put('/tickets/settings', async (req, res) => {
  try {
    await withAccess(req, true);
    const updated = updateGuildConfig(gid(req), {
      ticketsEnabled: req.body?.ticketsEnabled,
      ticketCategoryId: req.body?.ticketCategoryId ?? undefined,
      logChannelId: req.body?.logChannelId ?? undefined,
      staffRoleIds: Array.isArray(req.body?.staffRoleIds) ? req.body.staffRoleIds : undefined,
    });
    res.json({
      ticketsEnabled: updated.ticketsEnabled,
      ticketCategoryId: updated.ticketCategoryId,
      logChannelId: updated.logChannelId,
      staffRoleIds: updated.staffRoleIds,
    });
  } catch (error) {
    handleError(res, error, 'Failed to save ticket settings');
  }
});

guildManageRouter.get('/tickets/categories', async (req, res) => {
  try {
    await withAccess(req, false);
    const config = getGuildConfig(gid(req));
    const stored = Array.isArray(config.ticketTypes) ? config.ticketTypes : [];
    const defaults = Object.entries(TICKET_TYPES).map(([id, meta]) => ({
      id,
      label: meta.label,
      emoji: meta.emoji,
      enabled: true,
    }));
    res.json({
      categories: stored.length ? stored : defaults,
      defaults,
    });
  } catch (error) {
    handleError(res, error, 'Failed to load ticket categories');
  }
});

guildManageRouter.put('/tickets/categories', async (req, res) => {
  try {
    await withAccess(req, true);
    const categories = Array.isArray(req.body?.categories) ? req.body.categories : [];
    const updated = updateGuildConfig(gid(req), { ticketTypes: categories });
    res.json({ categories: updated.ticketTypes });
  } catch (error) {
    handleError(res, error, 'Failed to save ticket categories');
  }
});

// —— Bot general / security / integrations ——
guildManageRouter.get('/bot/general', async (req, res) => {
  try {
    await withAccess(req, false);
    const client = getClient();
    const config = getGuildConfig(gid(req));
    const guild = client.guilds.cache.get(gid(req));
    res.json({
      botTag: client.user?.tag ?? null,
      botId: client.user?.id ?? null,
      presence: client.user?.presence?.status ?? 'online',
      logChannelId: config.logChannelId,
      textChannels: guild
        ? [...guild.channels.cache.values()]
            .filter((c) => c.isTextBased() && !c.isThread() && 'name' in c)
            .map((c) => ({ id: c.id, name: (c as { name: string }).name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        : [],
    });
  } catch (error) {
    handleError(res, error, 'Failed to load bot settings');
  }
});

guildManageRouter.put('/bot/general', async (req, res) => {
  try {
    await withAccess(req, true);
    const updated = updateGuildConfig(gid(req), {
      logChannelId: req.body?.logChannelId ?? undefined,
    });
    res.json({ logChannelId: updated.logChannelId });
  } catch (error) {
    handleError(res, error, 'Failed to save bot settings');
  }
});

guildManageRouter.get('/security', async (req, res) => {
  try {
    await withAccess(req, false);
    const user = getSessionUser(req)!;
    const guild = getClient().guilds.cache.get(gid(req));
    const member = guild ? await guild.members.fetch(user.id).catch(() => null) : null;
    const activity = listActivity(gid(req), 15);
    res.json({
      you: {
        id: user.id,
        username: user.username,
        isOwner: guild?.ownerId === user.id,
        permissions: member?.permissions.toArray() ?? [],
        roles:
          member?.roles.cache
            .filter((r) => r.id !== guild?.id)
            .map((r) => r.name) ?? [],
      },
      policy: {
        dashboardAccess: 'Members of the server where the bot is present',
        writeAccess: 'Administrator, Manage Server, or Server Owner',
        sessionCookie: 'HTTP-only, 7-day session',
        rateLimit: 'API rate limited per IP',
      },
      recentAdminActions: activity.filter((a) =>
        /created|updated|deleted|timeout|kick|embed|role|channel/i.test(a.action),
      ),
    });
  } catch (error) {
    handleError(res, error, 'Failed to load security');
  }
});

guildManageRouter.get('/integrations', async (req, res) => {
  try {
    await withAccess(req, false);
    const client = getClient();
    const guild = client.guilds.cache.get(gid(req));
    res.json({
      discord: {
        connected: Boolean(guild),
        botTag: client.user?.tag ?? null,
        guildName: guild?.name ?? null,
        inviteHint:
          'https://discord.com/oauth2/authorize?client_id=' +
          (client.user?.id ?? '') +
          '&permissions=8&scope=bot%20applications.commands',
      },
      webhooks: {
        status: 'ready',
        note: 'Use Discord channel webhooks for external tools. Native webhook CRUD can be added next.',
      },
      oauth: {
        scopes: ['identify', 'guilds'],
        dashboardOrigin: process.env.DASHBOARD_ORIGIN || null,
      },
    });
  } catch (error) {
    handleError(res, error, 'Failed to load integrations');
  }
});

// silence unused helper warning in some TS configs

