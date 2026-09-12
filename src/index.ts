import { config } from './config';
import { createBotClient } from './bot/client';
import { deployCommands, registerCommandCollection } from './commands';
import { registerEvents } from './events';
import { startDashboardServer } from './dashboard/server';
import { getDb } from './db';
import { recordActivity } from './db/activityRepository';

async function main(): Promise<void> {
  console.log('[BOOT] Starting NEXUS | DEVELOPMENT bot + dashboard...');
  console.log('[BOOT] Environment validated (secrets present, values hidden).');

  getDb();

  const client = createBotClient();
  registerCommandCollection(client);
  registerEvents(client);

  try {
    await deployCommands(config.token, config.clientId, config.guildId);
  } catch (error) {
    console.error('[BOOT] Failed to register slash commands:', error);
    process.exit(1);
  }

  client.on('error', (error) => {
    console.error('[CLIENT] Error:', error);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[PROCESS] Unhandled rejection:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('[PROCESS] Uncaught exception:', error);
  });

  startDashboardServer();

  client.once('ready', () => {
    recordActivity({
      guildId: config.guildId,
      action: 'Bot connected',
      details: `Logged in as ${client.user?.tag ?? 'unknown'}`,
    });
  });

  await client.login(config.token);
}

main().catch((error) => {
  console.error('[BOOT] Fatal startup error:', error);
  process.exit(1);
});
