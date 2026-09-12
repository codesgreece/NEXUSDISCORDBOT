import { Events, Message, GuildMember, PartialGuildMember } from 'discord.js';
import type { Client } from 'discord.js';
import { readyHandler } from './ready';
import { interactionCreateHandler } from './interactionCreate';
import { handleAutomodMessage } from '../services/automodService';
import { handleMemberJoin, handleMemberLeave } from '../services/welcomeService';
import { logError } from '../services/loggingService';
import { isAutomaticBotActionsEnabled } from '../config/botRuntime';

/**
 * Event architecture is preserved. Automatic handlers no-op while
 * AUTOMATIC_BOT_ACTIONS_ENABLED is false (development mode).
 * InteractionCreate remains active for explicit user triggers.
 */
export function registerEvents(client: Client): void {
  client.once(Events.ClientReady, readyHandler);
  client.on(Events.InteractionCreate, interactionCreateHandler);

  client.on(Events.MessageCreate, async (message: Message) => {
    if (!isAutomaticBotActionsEnabled()) return;
    try {
      await handleAutomodMessage(message);
    } catch (error) {
      await logError(message.guild, error, 'messageCreate/automod');
    }
  });

  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    if (!isAutomaticBotActionsEnabled()) return;
    try {
      await handleMemberJoin(member);
    } catch (error) {
      await logError(member.guild, error, 'guildMemberAdd/welcome');
    }
  });

  client.on(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
    if (!isAutomaticBotActionsEnabled()) return;
    try {
      await handleMemberLeave(member);
    } catch (error) {
      await logError(member.guild, error, 'guildMemberRemove/welcome');
    }
  });
}
