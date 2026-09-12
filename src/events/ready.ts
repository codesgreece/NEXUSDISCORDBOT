import { ActivityType, Client } from 'discord.js';
import { BRAND } from '../config/serverStructure';

export async function readyHandler(client: Client<true>): Promise<void> {
  console.log(`[READY] Logged in as ${client.user.tag}`);
  console.log(`[READY] Serving ${client.guilds.cache.size} guild(s)`);

  client.user.setActivity(BRAND.name, { type: ActivityType.Watching });
}
