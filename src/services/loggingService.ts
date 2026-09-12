import {
  EmbedBuilder,
  Guild,
  TextChannel,
} from 'discord.js';
import { BRAND } from '../config/serverStructure';
import { findTextChannelByName } from '../utils/discord';
import { recordActivity } from '../db/activityRepository';

export interface LogPayload {
  title: string;
  description: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  /** Optional actor for dashboard activity feed */
  actorId?: string;
  actorTag?: string;
}

export async function logEvent(guild: Guild, payload: LogPayload): Promise<void> {
  try {
    recordActivity({
      guildId: guild.id,
      action: payload.title,
      userId: payload.actorId,
      userTag: payload.actorTag,
      details: payload.description.replace(/\*|`/g, '').slice(0, 500),
    });
  } catch (error) {
    console.error('[LOG] Failed to persist activity:', error);
  }

  try {
    const logsChannel = findTextChannelByName(guild, '📝・logs');
    if (!logsChannel) {
      console.warn('[LOG] Logs channel not found — skipping Discord log.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(payload.color ?? BRAND.accent)
      .setTitle(payload.title)
      .setDescription(payload.description)
      .setFooter({ text: BRAND.name })
      .setTimestamp();

    if (payload.fields?.length) {
      embed.addFields(payload.fields);
    }

    await (logsChannel as TextChannel).send({ embeds: [embed] });
  } catch (error) {
    console.error('[LOG] Failed to write log entry:', error);
  }
}

export async function logError(guild: Guild | null, error: unknown, context: string): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ERROR] ${context}:`, error);

  if (!guild) return;

  await logEvent(guild, {
    title: 'Error',
    description: `**Context:** ${context}\n\`\`\`${message.slice(0, 1000)}\`\`\``,
    color: BRAND.danger,
  });
}
