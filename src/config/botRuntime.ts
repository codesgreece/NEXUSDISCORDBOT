/**
 * Temporary DEVELOPMENT MODE for NEXUS Discord bot.
 *
 * When false: the bot stays online and only executes explicit
 * slash commands / buttons / selects / modals. No autonomous
 * Discord or background mutations from events, ready hooks,
 * timers, or startup tasks.
 *
 * Implementation code for welcome, AutoMod, sync, setup, etc.
 * remains in the project — only automatic *execution* is gated.
 *
 * Flip to `true` only when Cursor intentionally re-enables
 * automatic behavior (not via Discord admin UI).
 */
export const AUTOMATIC_BOT_ACTIONS_ENABLED = false;

export function isAutomaticBotActionsEnabled(): boolean {
  return AUTOMATIC_BOT_ACTIONS_ENABLED;
}
