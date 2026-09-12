import {
  Client,
  Collection,
  REST,
  Routes,
} from 'discord.js';
import type { Command } from './types';
import { setupCommand } from './setup';

export type { Command } from './types';

export const commands: Command[] = [setupCommand];

export function registerCommandCollection(client: Client): void {
  client.commands = new Collection();
  for (const command of commands) {
    client.commands.set(command.data.name, command);
  }
}

export async function deployCommands(
  token: string,
  clientId: string,
  guildId: string,
): Promise<void> {
  const body = commands.map((command) => command.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(token);

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
  console.log(`[COMMANDS] Registered ${body.length} guild slash command(s).`);
}

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, Command>;
  }
}
