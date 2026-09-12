import { Client } from 'discord.js';
import { isAutomaticBotActionsEnabled } from '../config/botRuntime';

/**
 * Passive ready handler (development mode):
 * log connection only — no Discord mutations, no sync, no setup,
 * no panel refresh, no presence/activity changes unless automation is re-enabled.
 */
export async function readyHandler(client: Client<true>): Promise<void> {
  console.log(`[READY] Logged in as ${client.user.tag}`);
  console.log(`[READY] Serving ${client.guilds.cache.size} guild(s)`);
  console.log(
    `[READY] Automatic bot actions: ${isAutomaticBotActionsEnabled() ? 'ENABLED' : 'DISABLED (development mode — explicit interactions only)'}`,
  );

  // Intentionally no setActivity / guild scans / sync / setup here.
  // Presence updates and other ready-side effects stay behind the flag
  // so re-enabling automation does not require rewriting this file.
  if (!isAutomaticBotActionsEnabled()) {
    return;
  }

  // Reserved for future automatic ready tasks when flag is true.
  // Do not add Discord/server mutations here without an explicit product decision.
}
