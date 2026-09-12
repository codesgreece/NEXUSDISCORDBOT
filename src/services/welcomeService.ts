import {
  EmbedBuilder,
  GuildMember,
  PartialGuildMember,
  TextChannel,
} from 'discord.js';
import { BRAND } from '../config/serverStructure';
import { getWelcomeSettings, type WelcomeSettings } from '../db/controlRepository';
import { logEvent, logError } from './loggingService';

function parseColor(raw: string | undefined): number {
  if (!raw) return BRAND.accent;
  const cleaned = raw.trim().replace(/^#/, '');
  const n = Number.parseInt(cleaned, 16);
  return Number.isFinite(n) ? n : BRAND.accent;
}

function replaceVars(
  template: string,
  member: GuildMember | PartialGuildMember,
  settings: WelcomeSettings,
): string {
  const user = member.user;
  const username = user?.username ?? 'Unknown';
  const mention = user ? `<@${user.id}>` : '@unknown';
  const server = member.guild.name;
  const memberCount = String(member.guild.memberCount);
  return template
    .replaceAll('{user}', mention)
    .replaceAll('{username}', username)
    .replaceAll('{server}', server)
    .replaceAll('{memberCount}', memberCount);
}

async function resolveTextChannel(
  member: GuildMember | PartialGuildMember,
  channelId: string | null,
): Promise<TextChannel | null> {
  if (!channelId) return null;
  const channel = await member.guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || channel.isDMBased()) return null;
  return channel as TextChannel;
}

export async function handleMemberJoin(member: GuildMember): Promise<void> {
  const settings = getWelcomeSettings(member.guild.id);
  if (!settings.enabled) return;

  try {
    const channel = await resolveTextChannel(member, settings.channelId);
    if (channel) {
      const embed = new EmbedBuilder()
        .setColor(parseColor(settings.color))
        .setTitle(replaceVars(settings.title, member, settings))
        .setDescription(replaceVars(settings.description, member, settings))
        .setFooter({ text: replaceVars(settings.footer || BRAND.name, member, settings) })
        .setTimestamp();

      if (settings.thumbnail && member.user) {
        embed.setThumbnail(member.user.displayAvatarURL({ size: 256 }));
      }
      if (settings.imageUrl) {
        embed.setImage(settings.imageUrl);
      }

      await channel.send({
        content: replaceVars('{user}', member, settings),
        embeds: [embed],
      });
    }

    const autoRoleId = settings.autoRoleId;
    if (autoRoleId) {
      await member.roles.add(autoRoleId, 'Welcome auto-role').catch(() => undefined);
    }

    if (settings.dmEnabled && settings.dmMessage && member.user) {
      const dmText = replaceVars(settings.dmMessage, member, settings);
      await member.send(dmText).catch(() => undefined);
    }

    await logEvent(member.guild, {
      title: 'WELCOME · Join',
      description: `${member.user.tag} μπήκε στο server (μέλος #${member.guild.memberCount}).`,
      color: BRAND.success,
      actorId: member.id,
      actorTag: member.user.tag,
    });
  } catch (error) {
    await logError(member.guild, error, 'welcomeService.handleMemberJoin');
  }
}

export async function handleMemberLeave(
  member: GuildMember | PartialGuildMember,
): Promise<void> {
  const settings = getWelcomeSettings(member.guild.id);
  if (!settings.leaveEnabled) return;

  try {
    const channel = await resolveTextChannel(member, settings.leaveChannelId);
    if (!channel) return;

    const text = replaceVars(settings.leaveMessage || '{username} αποχώρησε.', member, settings);
    await channel.send({ content: text });

    await logEvent(member.guild, {
      title: 'WELCOME · Leave',
      description: `${member.user?.tag ?? member.id} αποχώρησε από το server.`,
      color: BRAND.warning,
      actorId: member.id,
      actorTag: member.user?.tag,
    });
  } catch (error) {
    await logError(member.guild, error, 'welcomeService.handleMemberLeave');
  }
}
