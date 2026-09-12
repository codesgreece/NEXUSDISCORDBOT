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
import { listProducts, updateProduct, type ShopProduct } from '../db/shopProductRepository';

function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return 'Τιμή σύντομα';
  return `€${price.toFixed(2)}`;
}

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

function buildCategoryHeaderEmbed(categoryKey: string, count: number): EmbedBuilder {
  const def = getCategory(categoryKey) ?? getCategoryDefinition(categoryKey);
  const emoji = def?.emoji ?? '🛍️';
  const name = def?.name ?? categoryKey;
  return new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle(`${emoji} NEXUS | ${name.toUpperCase()}`)
    .setDescription(
      `Επίσημος κατάλογος προϊόντων.\nΕνεργά προϊόντα: **${count}**\n\nΠατήστε **Αγορά** ή **Πληροφορίες**.`,
    )
    .setFooter({ text: BRAND.name })
    .setTimestamp();
}

function resolveChannel(guild: Guild, categoryKey: string): TextChannel | null {
  const cat = getCategory(categoryKey) ?? getCategoryDefinition(categoryKey);
  if (!cat) return null;
  return findTextChannelByName(guild, cat.channelName) ?? null;
}

/** EDIT existing product message or CREATE once — never duplicates */
export async function syncProductToDiscord(
  guild: Guild,
  product: ShopProduct,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const channel = resolveChannel(guild, product.category);
  if (!channel) {
    return { ok: false, error: `Channel missing for ${product.category}` };
  }

  const payload = {
    embeds: [buildProductEmbed(product)],
    components: product.active ? [buildProductButtons(product.id)] : [],
  };

  try {
    if (product.discordMessageId && product.discordChannelId === channel.id) {
      try {
        const existing = await channel.messages.fetch(product.discordMessageId);
        await existing.edit(payload);
        return { ok: true, messageId: existing.id };
      } catch {
        // fall through to create
      }
    }

    const created = await channel.send(payload);
    updateProduct(product.id, {
      discordChannelId: channel.id,
      discordMessageId: created.id,
    });
    return { ok: true, messageId: created.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function syncCategoryHeader(
  guild: Guild,
  categoryKey: string,
  channel: TextChannel,
  count: number,
): Promise<void> {
  const sync = getGuildSync(guild.id, categoryKey);
  const embed = buildCategoryHeaderEmbed(categoryKey, count);

  if (sync?.headerMessageId) {
    try {
      const msg = await channel.messages.fetch(sync.headerMessageId);
      await msg.edit({ embeds: [embed] });
      upsertGuildSync(guild.id, categoryKey, { channelId: channel.id });
      return;
    } catch {
      // recreate
    }
  }

  const created = await channel.send({ embeds: [embed] });
  upsertGuildSync(guild.id, categoryKey, {
    channelId: channel.id,
    headerMessageId: created.id,
  });
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
    const products = allInCategory.filter((p) => p.active);
    // Skip empty categories so we do not spam unused channels with headers.
    if (allInCategory.length === 0) continue;

    const channel = findTextChannelByName(guild, category.channelName);
    if (!channel) {
      result.errors.push(`Missing channel: ${category.channelName} (${category.key})`);
      continue;
    }
    result.categories += 1;

    try {
      await syncCategoryHeader(guild, category.key, channel, products.length);
    } catch (error) {
      result.errors.push(
        `Header ${category.key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    for (const product of products) {
      const sync = await syncProductToDiscord(guild, product);
      if (sync.ok) result.productsSynced += 1;
      else {
        result.productsFailed += 1;
        if (sync.error) result.errors.push(`${product.name}: ${sync.error}`);
      }
    }

    const inactive = allInCategory.filter((p) => !p.active);
    for (const product of inactive) {
      if (!product.discordMessageId || !product.discordChannelId) continue;
      try {
        const ch =
          product.discordChannelId === channel.id
            ? channel
            : ((await guild.channels.fetch(product.discordChannelId).catch(() => null)) as TextChannel | null);
        if (!ch?.isTextBased()) continue;
        const msg = await ch.messages.fetch(product.discordMessageId);
        await msg.edit({
          embeds: [
            buildProductEmbed(product).setTitle(
              `${product.emoji} ${product.name} (unavailable)`,
            ),
          ],
          components: [],
        });
      } catch {
        // ignore
      }
    }
  }

  return result;
}
