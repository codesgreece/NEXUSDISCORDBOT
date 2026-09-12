import { Message } from 'discord.js';
import {
  getAutomodSettings,
  type AutomodRule,
  type AutomodSettings,
} from '../db/controlRepository';
import { getClient } from '../bot/client';
import {
  banMember,
  timeoutMemberModeration,
  warnMember,
} from './moderationService';
import { kickMember } from './memberService';
import { logEvent } from './loggingService';
import { BRAND } from '../config/serverStructure';

const INVITE_RE = /discord(?:\.gg|app\.com\/invite|\.com\/invite)\/[a-zA-Z0-9-]+/i;
const LINK_RE = /https?:\/\/\S+/i;

type AutomodKey = keyof AutomodSettings;

interface Violation {
  key: AutomodKey;
  rule: AutomodRule;
  detail: string;
}

function capsRatio(content: string): number {
  const letters = content.replace(/[^a-zA-ZΑ-Ωα-ωΆ-Ώά-ώ]/g, '');
  if (letters.length < 8) return 0;
  const upper = letters.replace(/[^A-ZΑ-ΩΆ-Ώ]/g, '').length;
  return (upper / letters.length) * 100;
}

function findViolation(content: string, settings: AutomodSettings, mentionCount: number): Violation | null {
  if (settings.antiInvite.enabled && INVITE_RE.test(content)) {
    return { key: 'antiInvite', rule: settings.antiInvite, detail: 'Discord invite' };
  }

  if (settings.antiLink.enabled && LINK_RE.test(content)) {
    return { key: 'antiLink', rule: settings.antiLink, detail: 'External link' };
  }

  if (settings.antiMention.enabled && mentionCount >= settings.antiMention.threshold) {
    return {
      key: 'antiMention',
      rule: settings.antiMention,
      detail: `${mentionCount} mentions (threshold ${settings.antiMention.threshold})`,
    };
  }

  if (settings.capsProtect.enabled) {
    const ratio = capsRatio(content);
    if (ratio >= settings.capsProtect.threshold) {
      return {
        key: 'capsProtect',
        rule: settings.capsProtect,
        detail: `${Math.round(ratio)}% caps (threshold ${settings.capsProtect.threshold}%)`,
      };
    }
  }

  if (settings.badWords.enabled && settings.badWords.words.length) {
    const lower = content.toLowerCase();
    const hit = settings.badWords.words.find((w) => w && lower.includes(w.toLowerCase()));
    if (hit) {
      return { key: 'badWords', rule: settings.badWords, detail: `Blocked word` };
    }
  }

  return null;
}

async function applyAction(
  message: Message,
  violation: Violation,
): Promise<void> {
  if (!message.guild || !message.member) return;

  const guild = message.guild;
  const userId = message.author.id;
  const botId = getClient().user?.id ?? guild.members.me?.id ?? userId;
  const reason = `AutoMod · ${violation.key}: ${violation.detail}`;
  const action = violation.rule.action;

  if (action === 'delete' || action === 'warn' || action === 'timeout' || action === 'kick' || action === 'ban') {
    if (action === 'delete' || message.deletable) {
      await message.delete().catch(() => undefined);
    }
  }

  if (action === 'warn') {
    await warnMember(guild, userId, botId, reason);
  } else if (action === 'timeout') {
    await timeoutMemberModeration(
      guild,
      userId,
      botId,
      violation.rule.timeoutMinutes || 10,
      reason,
    );
  } else if (action === 'kick') {
    await kickMember(guild.id, userId, { id: botId, tag: 'AutoMod' });
  } else if (action === 'ban') {
    await banMember(guild, userId, botId, reason);
  } else if (action === 'delete') {
    await logEvent(guild, {
      title: 'AUTOMOD · Delete',
      description: `Διαγράφηκε μήνυμα από <@${userId}> · ${violation.key}\n${violation.detail}`,
      color: BRAND.warning,
      actorId: botId,
      actorTag: 'AutoMod',
    });
  }
}

/**
 * Process a guild message against automod rules.
 * Requires GuildMessages + MessageContent intents when wired in the client.
 */
export async function handleAutomodMessage(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot) return false;
  if (!message.member) return false;

  let settings: AutomodSettings;
  try {
    settings = getAutomodSettings(message.guild.id);
  } catch {
    return false;
  }

  const mentionCount =
    message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 1 : 0);

  const violation = findViolation(message.content || '', settings, mentionCount);
  if (!violation) return false;

  try {
    await applyAction(message, violation);
    return true;
  } catch (error) {
    console.error('[AUTOMOD] Failed to apply action:', error);
    return false;
  }
}
