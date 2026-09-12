import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';
import { BRAND } from '../config/serverStructure';
import { NEXUS_IDS, getShopCategories } from '../config/contentMapping';
import { getProduct, listProducts } from '../db/shopProductRepository';
import { buildProductButtons, buildProductEmbed } from './discordShopSyncService';

export async function openShopMenu(interaction: ChatInputCommandInteraction): Promise<void> {
  const cats = getShopCategories();
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('🛒 NEXUS | DEVELOPMENT SHOP')
    .setDescription('Επίλεξε κατηγορία για να δεις τα διαθέσιμα προϊόντα.')
    .setFooter({ text: BRAND.name });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...cats.slice(0, 5).map((c) =>
      new ButtonBuilder()
        .setCustomId(`${NEXUS_IDS.SHOP_CAT}:${c.key}`)
        .setLabel(c.name)
        .setEmoji(c.emoji)
        .setStyle(ButtonStyle.Primary),
    ),
  );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

export async function handleShopCategoryButton(interaction: ButtonInteraction): Promise<void> {
  const key = interaction.customId.slice(`${NEXUS_IDS.SHOP_CAT}:`.length);
  const products = listProducts({ category: key, activeOnly: true });
  const cat = getShopCategories().find((c) => c.key === key);

  if (!products.length) {
    await interaction.reply({
      content: `Δεν υπάρχουν ενεργά προϊόντα στην κατηγορία **${cat?.name ?? key}**.`,
      ephemeral: true,
    });
    return;
  }

  // Show up to 5 product embeds in one ephemeral message + select for more buy actions
  const embeds = products.slice(0, 5).map((p) => buildProductEmbed(p));
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${NEXUS_IDS.SHOP_CAT}:pick:${key}`)
    .setPlaceholder('Επίλεξε προϊόν για αγορά / πληροφορίες…')
    .addOptions(
      products.slice(0, 25).map((p) => ({
        label: p.name.slice(0, 100),
        value: p.id,
        emoji: p.emoji || undefined,
        description: (p.price === null ? 'Τιμή σύντομα' : `€${p.price.toFixed(2)}`).slice(0, 100),
      })),
    );

  await interaction.reply({
    content: `**${cat?.emoji ?? '🛍️'} ${cat?.name ?? key}** — ${products.length} προϊόν(τα)`,
    embeds,
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(NEXUS_IDS.SHOP_ROOT)
          .setLabel('Πίσω στο Shop')
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
    ephemeral: true,
  });
}

export async function handleShopPickSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const productId = interaction.values[0];
  const product = getProduct(productId);
  if (!product || !product.active) {
    await interaction.reply({ content: 'Το προϊόν δεν είναι διαθέσιμο.', ephemeral: true });
    return;
  }
  await interaction.reply({
    embeds: [buildProductEmbed(product)],
    components: [buildProductButtons(product.id)],
    ephemeral: true,
  });
}

export async function handleShopRootButton(interaction: ButtonInteraction): Promise<void> {
  const cats = getShopCategories();
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('🛒 NEXUS | DEVELOPMENT SHOP')
    .setDescription('Επίλεξε κατηγορία:')
    .setFooter({ text: BRAND.name });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...cats.slice(0, 5).map((c) =>
      new ButtonBuilder()
        .setCustomId(`${NEXUS_IDS.SHOP_CAT}:${c.key}`)
        .setLabel(c.name)
        .setEmoji(c.emoji)
        .setStyle(ButtonStyle.Primary),
    ),
  );
  await interaction.update({ embeds: [embed], components: [row] });
}
