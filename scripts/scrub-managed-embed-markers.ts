/**
 * One-shot cleanup: strip visible <!-- NEXUS_* --> markers from managed embeds.
 * Does not create duplicates and does not change embed wording.
 */
import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { getDb } from '../src/db';
import { setClient } from '../src/bot/client';
import { scrubAllManagedEmbedMarkers } from '../src/services/embedEditorService';

async function main(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const guildId = process.env.GUILD_ID;
  if (!token || !guildId) {
    throw new Error('DISCORD_TOKEN and GUILD_ID are required');
  }

  getDb();

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });
  setClient(client);

  await client.login(token);
  await new Promise<void>((resolve) => client.once('clientReady', () => resolve()));

  console.log('[CLEANUP] Scrubbing managed embed markers...');
  const results = await scrubAllManagedEmbedMarkers(guildId);
  for (const r of results) {
    console.log(
      `[CLEANUP] ${r.kind}: scrubbed=${r.scrubbed} messageId=${r.messageId ?? 'none'}`,
    );
  }

  const guild = client.guilds.cache.get(guildId);
  if (guild) {
    for (const name of [
      '👋・welcome',
      '📜・rules',
      '💼・services',
      '💰・pricing',
      '🎫・create-ticket',
    ]) {
      const ch = guild.channels.cache.find((c) => 'name' in c && c.name === name);
      if (!ch || !ch.isTextBased()) {
        console.log(`[CLEANUP] verify #${name}: channel missing`);
        continue;
      }
      const msgs = await ch.messages.fetch({ limit: 20 });
      const dirty = msgs.filter(
        (m) => m.author.bot && /<!--\s*NEXUS_/i.test(m.content || ''),
      );
      console.log(
        `[CLEANUP] verify #${name}: remaining marker messages=${dirty.size}`,
      );
    }
  }

  await client.destroy();
  console.log('[CLEANUP] Done');
}

main().catch((err) => {
  console.error('[CLEANUP] Failed:', err);
  process.exit(1);
});
