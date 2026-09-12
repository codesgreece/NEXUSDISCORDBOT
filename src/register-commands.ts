import { config } from './config';
import { deployCommands } from './commands';

async function main(): Promise<void> {
  console.log('[REGISTER] Deploying slash commands...');
  await deployCommands(config.token, config.clientId, config.guildId);
  console.log('[REGISTER] Done.');
}

main().catch((error) => {
  console.error('[REGISTER] Failed:', error);
  process.exit(1);
});
