import {
  Client,
  GatewayIntentBits,
  Partials,
} from 'discord.js';

let clientInstance: Client | null = null;

export function createBotClient(): Client {
  if (clientInstance) return clientInstance;

  clientInstance = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.GuildMember],
  });

  return clientInstance;
}

export function getClient(): Client {
  if (!clientInstance) {
    throw new Error('Discord client has not been initialized yet.');
  }
  return clientInstance;
}

export function getClientOrNull(): Client | null {
  return clientInstance;
}
