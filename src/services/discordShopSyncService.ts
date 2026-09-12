import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Guild,
  TextChannel,
} from 'discord.js';
import { BRAND } from '../config/serverStructure';
import { NEXUS_IDS, getCategoryDefinition } from '../config/contentMapping';
import { findTextChannelByName } from '../utils/discord';
import {
  ensureDefaultCategories,
  getCategory,
  getGuildSync,
  listCategories,
  upsertGuildSync,
} from '../db/shopCategoryRepository';
import {
  clearDiscordMessage,
  listProducts,
  type ShopProduct,
} from '../db/shopProductRepository';
import { buildShopPanelListPayload } from './shopPanelService';

function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return 'Τιμή σύντομα';
  return `€${price.toFixed(2)}`;
}

/** Used by /shop ephemeral browse + purchase confirmation */
export function buildProductEmbed(product: ShopProduct): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle(`${product.emoji} ${product.name}`)
    .setDescription(product.description || '—')
    .addFields({ name: '💰 Τιμή', value: formatPrice(product.price), inline: true })
    .setFooter({ text: `${BRAND.name} · ${product.category}` })
    .setTimestamp();
  if (product.imageUrl) embed.setImage(product.imageUrl);
  return embed;
}

export function buildProductButtons(productId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${NEXUS_IDS.BUY}:${productId}`)
      .setLabel('Αγορά')
      .setEmoji('🛒')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${NEXUS_IDS.INFO}:${productId}`)
      .setLabel('Πληροφορίες')
      .setEmoji('ℹ️')
      .setStyle(ButtonStyle.Secondary),
  );
}

function resolveChannel(guild: Guild, categoryKey: string): TextChannel | null {
  const cat = getCategory(categoryKey) ?? getCategoryDefinition(categoryKey);
  if (!cat) return null;
  return findTextChannelByName(guild, cat.channelName) ?? null;
}

/** Delete legacy per-product shop messages left by the old sync model */
async function cleanupLegacyProductMessages(
  guild: Guild,
  channel: TextChannel,
  products: ShopProduct[],
  panelMessageId: string | null,
): Promise<number> {
  let removed = 0;
  for (const product of products) {
    if (!product.discordMessageId) continue;
    // Never delete the panel message if an old row somehow pointed at it
    if (panelMessageId && product.discordMessageId === panelMessageId) {
      clearDiscordMessage(product.id);
      continue;
    }
    try {
      const ch =
        product.discordChannelId && product.discordChannelId !== channel.id
          ? ((await guild.channels
              .fetch(product.discordChannelId)
              .catch(() => null)) as TextChannel | null)
          : channel;
      if (ch?.isTextBased()) {
        const msg = await ch.messages.fetch(product.discordMessageId).catch(() => null);
        if (msg) {
          await msg.delete().catch(() => undefined);
          removed += 1;
        }
      }
    } catch {
      // ignore
    }
    clearDiscordMessage(product.id);
  }
  return removed;
}

/**
 * Upsert ONE compact shop panel message for a category channel.
 * Stores message id on shop_guild_sync.header_message_id (panel id).
 */
export async function syncCategoryPanel(
  guild: Guild,
  categoryKey: string,
): Promise<{ ok: boolean; messageId?: string; productCount?: number; error?: string }> {
  const channel = resolveChannel(guild, categoryKey);
  if (!channel) {
    return { ok: false, error: `Channel missing for ${categoryKey}` };
  }

  const allInCategory = listProducts({ category: categoryKey });
  const sync = getGuildSync(guild.id, categoryKey);
  const removed = await cleanupLegacyProductMessages(
    guild,
    channel,
    allInCategory,
    sync?.headerMessageId ?? null,
  );
  if (removed > 0) {
    console.log(
      `[SHOP] Cleaned ${removed} legacy product message(s) in #${channel.name} (${categoryKey})`,
    );
  }

  const payload = buildShopPanelListPayload(categoryKey, 0);

  try {
    if (sync?.headerMessageId) {
      try {
        const existing = await channel.messages.fetch(sync.headerMessageId);
        await existing.edit({
          content: null,
          embeds: payload.embeds,
          components: payload.components,
        });
        upsertGuildSync(guild.id, categoryKey, { channelId: channel.id });
        return {
          ok: true,
          messageId: existing.id,
          productCount: payload.productCount,
        };
      } catch {
        // recreate below
      }
    }

    const created = await channel.send({
      embeds: payload.embeds,
      components: payload.components,
    });
    upsertGuildSync(guild.id, categoryKey, {
      channelId: channel.id,
      headerMessageId: created.id,
    });
    return {
      ok: true,
      messageId: created.id,
      productCount: payload.productCount,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * After product create/edit/toggle: refresh the category panel (not a per-product message).
 * Kept name for compatibility with content manager + dashboard callers.
 */
export async function syncProductToDiscord(
  guild: Guild,
  product: ShopProduct,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  // Clear any leftover per-product message id — panel is the source of truth now
  if (product.discordMessageId) {
    clearDiscordMessage(product.id);
  }
  const result = await syncCategoryPanel(guild, product.category);
  return {
    ok: result.ok,
    messageId: result.messageId,
    error: result.error,
  };
}

export interface SyncShopResult {
  categories: number;
  productsSynced: number;
  productsFailed: number;
  errors: string[];
}

export async function syncShopToDiscord(guild: Guild): Promise<SyncShopResult> {
  ensureDefaultCategories();
  const categories = listCategories({ activeOnly: true });
  const result: SyncShopResult = {
    categories: 0,
    productsSynced: 0,
    productsFailed: 0,
    errors: [],
  };

  for (const category of categories) {
    const allInCategory = listProducts({ category: category.key });
    // Skip empty categories so we do not spam unused channels.
    if (allInCategory.length === 0) continue;

    const channel = findTextChannelByName(guild, category.channelName);
    if (!channel) {
      result.errors.push(`Missing channel: ${category.channelName} (${category.key})`);
      continue;
    }

    const panel = await syncCategoryPanel(guild, category.key);
    if (!panel.ok) {
      result.productsFailed += 1;
      if (panel.error) result.errors.push(`${category.key}: ${panel.error}`);
      continue;
    }

    result.categories += 1;
    result.productsSynced += panel.productCount ?? 0;
  }

  return result;
}

/** @deprecated alias — prefer syncCategoryPanel */
export async function refreshProductDiscord(
  guild: Guild,
  product: ShopProduct,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  return syncProductToDiscord(guild, product);
}
