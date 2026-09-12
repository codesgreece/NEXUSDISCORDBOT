import { Guild } from 'discord.js';
import { getDb } from '../db/index';
import { listProjects } from '../db/controlRepository';
import { syncShopToDiscord } from './discordShopSyncService';

export interface FullSyncOptions {
  shop?: boolean;
  content?: boolean;
  projects?: boolean;
}

export interface FullSyncResult {
  summary: string;
}

interface ManagedMessageRow {
  content_type: string;
  entity_id: string;
  channel_id: string;
  message_id: string;
}

function listManagedMessages(guildId: string): ManagedMessageRow[] {
  return getDb()
    .prepare(
      `SELECT content_type, entity_id, channel_id, message_id
       FROM managed_messages WHERE guild_id = ?`,
    )
    .all(guildId) as ManagedMessageRow[];
}

export async function runFullSync(
  guild: Guild,
  opts?: FullSyncOptions,
): Promise<FullSyncResult> {
  const doShop = opts?.shop !== false;
  const doContent = opts ? opts.content === true : true;
  const doProjects = opts ? opts.projects === true : true;
  const parts: string[] = [];

  if (doShop) {
    try {
      const result = await syncShopToDiscord(guild);
      const errorHint = result.errors.length
        ? ` (${result.errors.slice(0, 3).join('; ')})`
        : '';
      parts.push(
        `🛒 Shop: categories **${result.categories}**, products **${result.productsSynced}**, failed **${result.productsFailed}**${errorHint}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      parts.push(`🛒 Shop sync απέτυχε: ${message}`);
    }
  } else {
    parts.push('🛒 Shop sync παραλείφθηκε.');
  }

  if (doContent) {
    const managed = listManagedMessages(guild.id).filter(
      (row) => row.content_type !== 'project',
    );
    if (!managed.length) {
      parts.push('📢 Content: δεν υπάρχουν managed messages για sync.');
    } else {
      let ok = 0;
      let missing = 0;
      for (const row of managed) {
        try {
          const channel = await guild.channels.fetch(row.channel_id).catch(() => null);
          if (!channel || !channel.isTextBased() || channel.isDMBased()) {
            missing += 1;
            continue;
          }
          const msg = await channel.messages.fetch(row.message_id).catch(() => null);
          if (msg) ok += 1;
          else missing += 1;
        } catch {
          missing += 1;
        }
      }
      parts.push(`📢 Content: verified **${ok}** / missing **${missing}** managed messages.`);
    }
  }

  if (doProjects) {
    const projects = listProjects(guild.id);
    const managedProjects = listManagedMessages(guild.id).filter(
      (row) => row.content_type === 'project',
    );
    if (!projects.length && !managedProjects.length) {
      parts.push('🚀 Projects: τίποτα για sync.');
    } else {
      parts.push(
        `🚀 Projects: **${projects.length}** στη βάση` +
          (managedProjects.length
            ? `, **${managedProjects.length}** managed Discord messages`
            : ' (χωρίς managed Discord messages)'),
      );
    }
  }

  return {
    summary: `🔄 Full sync\n${parts.join('\n')}`,
  };
}
