import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';
import { BRAND } from '../config/serverStructure';
import {
  NEXUS_IDS,
  SHOP_PANEL_PAGE_SIZE,
  getCategoryDefinition,
} from '../config/contentMapping';
import { getCategory } from '../db/shopCategoryRepository';
import { getProduct, listProducts, type ShopProduct } from '../db/shopProductRepository';

function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return 'Σύντομα';
  return `€${price.toFixed(2)}`;
}

/** Split description into compact feature bullets */
export function productFeatures(product: ShopProduct): string[] {
  const raw = (product.description || '')
    .split(/[,;\n•]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (raw.length <= 1) {
    return raw.length ? raw : ['—'];
  }
  return raw.slice(0, 8);
}

function categoryMeta(categoryKey: string) {
  const def = getCategory(categoryKey) ?? getCategoryDefinition(categoryKey);
  return {
    key: categoryKey,
    name: def?.name ?? categoryKey,
    emoji: def?.emoji ?? '🛍️',
    blurb:
      getCategoryDefinition(categoryKey)?.panelBlurb ??
      '> Επίσημα προϊόντα NEXUS.',
    placeholder:
      getCategoryDefinition(categoryKey)?.selectPlaceholder ?? '🛒 Επιλέξτε προϊόν',
  };
}

function activeProducts(categoryKey: string): ShopProduct[] {
  return listProducts({ category: categoryKey, activeOnly: true });
}

function pageSlice(products: ShopProduct[], page: number): {
  page: number;
  totalPages: number;
  slice: ShopProduct[];
} {
  const totalPages = Math.max(1, Math.ceil(products.length / SHOP_PANEL_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * SHOP_PANEL_PAGE_SIZE;
  return {
    page: safePage,
    totalPages,
    slice: products.slice(start, start + SHOP_PANEL_PAGE_SIZE),
  };
}

export function buildShopPanelListEmbed(
  categoryKey: string,
  products: ShopProduct[],
  page: number,
): EmbedBuilder {
  const meta = categoryMeta(categoryKey);
  const { page: safePage, totalPages, slice } = pageSlice(products, page);

  const lines =
    slice.length === 0
      ? ['_Δεν υπάρχουν ενεργά προϊόντα._']
      : slice.map((p) => `${p.emoji} **${p.name}** — ${formatPrice(p.price)}`);

  const pageNote =
    totalPages > 1 ? `\nΣελίδα **${safePage + 1}/${totalPages}**` : '';

  return new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle(`${meta.emoji} NEXUS | ${meta.name.toUpperCase()}`)
    .setDescription(
      [
        meta.blurb,
        '',
        lines.join('\n'),
        '',
        '👇 Επιλέξτε ένα προϊόν για περισσότερες πληροφορίες',
        pageNote,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .setFooter({ text: BRAND.name })
    .setTimestamp();
}

export function buildShopPanelDetailEmbed(product: ShopProduct): EmbedBuilder {
  const features = productFeatures(product);
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle(`${product.emoji} ${product.name.toUpperCase()}`)
    .setDescription(product.description || '—')
    .addFields({ name: '💰 Τιμή', value: formatPrice(product.price), inline: true })
    .setFooter({ text: `${BRAND.name} · ${product.category}` })
    .setTimestamp();

  // Only show a Features block when description yields multiple items
  if (features.length > 1) {
    embed.addFields({
      name: '📦 Features',
      value: features.map((f) => `• ${f}`).join('\n'),
      inline: false,
    });
  }

  if (product.imageUrl) embed.setImage(product.imageUrl);
  return embed;
}

export function buildShopPanelListComponents(
  categoryKey: string,
  products: ShopProduct[],
  page: number,
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const meta = categoryMeta(categoryKey);
  const { page: safePage, totalPages, slice } = pageSlice(products, page);
  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];

  if (slice.length > 0) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`${NEXUS_IDS.PANEL_SELECT}:${categoryKey}:${safePage}`)
      .setPlaceholder(meta.placeholder)
      .addOptions(
        slice.map((p) => ({
          label: p.name.slice(0, 100),
          value: p.id,
          emoji: p.emoji || undefined,
          description: formatPrice(p.price).slice(0, 100),
        })),
      );
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
  }

  if (totalPages > 1) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${NEXUS_IDS.PANEL_PAGE}:${categoryKey}:${safePage - 1}`)
          .setLabel('Previous')
          .setEmoji('⬅️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage <= 0),
        new ButtonBuilder()
          .setCustomId(`${NEXUS_IDS.PANEL_PAGE}:${categoryKey}:${safePage + 1}`)
          .setLabel('Next')
          .setEmoji('➡️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage >= totalPages - 1),
      ),
    );
  }

  return rows;
}

export function buildShopPanelDetailComponents(
  categoryKey: string,
  productId: string,
  page: number,
): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${NEXUS_IDS.BUY}:${productId}`)
        .setLabel('Αγορά')
        .setEmoji('🛒')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${NEXUS_IDS.PANEL_BACK}:${categoryKey}:${page}`)
        .setLabel('Πίσω')
        .setEmoji('↩️')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

/** Payload for the main list view of a category shop panel */
export function buildShopPanelListPayload(categoryKey: string, page = 0) {
  const products = activeProducts(categoryKey);
  return {
    embeds: [buildShopPanelListEmbed(categoryKey, products, page)],
    components: buildShopPanelListComponents(categoryKey, products, page),
    productCount: products.length,
  };
}

function parsePanelParts(customId: string, prefix: string): { categoryKey: string; page: number } | null {
  if (!customId.startsWith(`${prefix}:`)) return null;
  const rest = customId.slice(prefix.length + 1);
  const lastColon = rest.lastIndexOf(':');
  if (lastColon <= 0) return null;
  const categoryKey = rest.slice(0, lastColon);
  const page = Number(rest.slice(lastColon + 1));
  if (!categoryKey || !Number.isFinite(page)) return null;
  return { categoryKey, page };
}

/** User picked a product from the channel shop panel — EDIT same message */
export async function handlePanelSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const parsed = parsePanelParts(interaction.customId, NEXUS_IDS.PANEL_SELECT);
  if (!parsed) {
    await interaction.reply({ content: '❌ Invalid panel select.', ephemeral: true });
    return;
  }

  const productId = interaction.values[0];
  const product = getProduct(productId);
  if (!product || !product.active) {
    await interaction.reply({ content: '❌ Το προϊόν δεν είναι διαθέσιμο.', ephemeral: true });
    return;
  }

  await interaction.update({
    embeds: [buildShopPanelDetailEmbed(product)],
    components: buildShopPanelDetailComponents(parsed.categoryKey, product.id, parsed.page),
  });
}

/** Back to compact list — EDIT same message */
export async function handlePanelBack(interaction: ButtonInteraction): Promise<void> {
  const parsed = parsePanelParts(interaction.customId, NEXUS_IDS.PANEL_BACK);
  if (!parsed) {
    await interaction.reply({ content: '❌ Invalid back button.', ephemeral: true });
    return;
  }
  const payload = buildShopPanelListPayload(parsed.categoryKey, parsed.page);
  await interaction.update({
    embeds: payload.embeds,
    components: payload.components,
  });
}

/** Pagination on the list view — EDIT same message */
export async function handlePanelPage(interaction: ButtonInteraction): Promise<void> {
  const parsed = parsePanelParts(interaction.customId, NEXUS_IDS.PANEL_PAGE);
  if (!parsed) {
    await interaction.reply({ content: '❌ Invalid page button.', ephemeral: true });
    return;
  }
  const payload = buildShopPanelListPayload(parsed.categoryKey, parsed.page);
  await interaction.update({
    embeds: payload.embeds,
    components: payload.components,
  });
}
