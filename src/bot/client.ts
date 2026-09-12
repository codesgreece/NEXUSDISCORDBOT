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
    ],
    partials: [Partials.Channel],
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
