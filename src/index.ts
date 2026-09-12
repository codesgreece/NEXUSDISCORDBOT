import { config } from './config';
import { createBotClient } from './bot/client';
import { deployCommands, registerCommandCollection } from './commands';
import { registerEvents } from './events';
import { startDashboardServer } from './dashboard/server';
import { getDb } from './db';
import { isAutomaticBotActionsEnabled } from './config/botRuntime';

async function main(): Promise<void> {
  console.log('[BOOT] Starting NEXUS | DEVELOPMENT bot + dashboard...');
  console.log('[BOOT] Environment validated (secrets present, values hidden).');
  console.log(
    `[BOOT] Automatic bot actions: ${isAutomaticBotActionsEnabled() ? 'ENABLED' : 'DISABLED — wait for explicit slash/button/select/modal'}`,
  );

  // Schema open + migrations only. No Discord mutations, no activity logging,
  // no shop/content sync, no setup on boot.
  getDb();

  const client = createBotClient();
  registerCommandCollection(client);
  registerEvents(client);

  try {
    // Explicit boot step allowed: register/load slash commands with Discord.
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

  await client.login(config.token);
}

main().catch((error) => {
  console.error('[BOOT] Fatal startup error:', error);
  process.exit(1);
});
