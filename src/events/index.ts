import { Events, Message, GuildMember, PartialGuildMember } from 'discord.js';
import type { Client } from 'discord.js';
import { readyHandler } from './ready';
import { interactionCreateHandler } from './interactionCreate';
import { handleAutomodMessage } from '../services/automodService';
import { handleMemberJoin, handleMemberLeave } from '../services/welcomeService';
import { logError } from '../services/loggingService';

export function registerEvents(client: Client): void {
  client.once(Events.ClientReady, readyHandler);
  client.on(Events.InteractionCreate, interactionCreateHandler);

  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      await handleAutomodMessage(message);
    } catch (error) {
      await logError(message.guild, error, 'messageCreate/automod');
    }
  });

  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    try {
      await handleMemberJoin(member);
    } catch (error) {
      await logError(member.guild, error, 'guildMemberAdd/welcome');
    }
  });

  client.on(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
    try {
      await handleMemberLeave(member);
    } catch (error) {
      await logError(member.guild, error, 'guildMemberRemove/welcome');
    }
  });
}
