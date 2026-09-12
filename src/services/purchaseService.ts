import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { BRAND } from '../config/serverStructure';
import { NEXUS_IDS } from '../config/contentMapping';
import { getProduct } from '../db/shopProductRepository';
import { checkoutShopOrder } from './shopCheckoutService';
import { buildProductEmbed } from './discordShopSyncService';

export async function handleBuyButton(interaction: ButtonInteraction): Promise<void> {
  const productId = interaction.customId.slice(`${NEXUS_IDS.BUY}:`.length);
  const product = getProduct(productId);
  if (!product || !product.active) {
    await interaction.reply({ content: '❌ Το προϊόν δεν είναι διαθέσιμο.', ephemeral: true });
    return;
  }

  const embed = buildProductEmbed(product).setTitle(
    `🛒 Επιβεβαίωση αγοράς — ${product.emoji} ${product.name}`,
  );
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${NEXUS_IDS.BUY_CONFIRM}:${product.id}`)
      .setLabel('Επιβεβαίωση')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(NEXUS_IDS.BUY_CANCEL)
      .setLabel('Ακύρωση')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

export async function handleBuyConfirm(interaction: ButtonInteraction): Promise<void> {
  const productId = interaction.customId.slice(`${NEXUS_IDS.BUY_CONFIRM}:`.length);
  const product = getProduct(productId);
  if (!product || !product.active) {
    await interaction.reply({ content: '❌ Το προϊόν δεν είναι διαθέσιμο.', ephemeral: true });
    return;
  }
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Μόνο μέσα σε server.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const result = await checkoutShopOrder({
      guildId: interaction.guild.id,
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      items: [{ productId: product.id, quantity: 1 }],
      notes: 'Discord shop purchase',
    });

    const embed = new EmbedBuilder()
      .setColor(BRAND.success)
      .setTitle('✅ Παραγγελία δημιουργήθηκε')
      .setDescription('Άνοιξε purchase ticket για το staff. Δεν έγινε πραγματική πληρωμή.')
      .addFields(
        { name: 'Order ID', value: `\`${result.order.id}\``, inline: true },
        {
          name: 'Προϊόν',
          value: `${product.emoji} ${product.name}`,
          inline: true,
        },
        {
          name: 'Τιμή',
          value: product.price === null ? 'Τιμή σύντομα' : `€${product.price.toFixed(2)}`,
          inline: true,
        },
        {
          name: 'Status',
          value: result.order.status,
          inline: true,
        },
        {
          name: 'Ticket',
          value: `<#${result.ticketChannelId}>`,
          inline: true,
        },
      )
      .setFooter({ text: BRAND.name })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({
      content: `❌ Checkout failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

export async function handleBuyCancel(interaction: ButtonInteraction): Promise<void> {
  await interaction.update({
    content: 'Ακυρώθηκε.',
    embeds: [],
    components: [],
  });
}

export async function handleInfoButton(interaction: ButtonInteraction): Promise<void> {
  const productId = interaction.customId.slice(`${NEXUS_IDS.INFO}:`.length);
  const product = getProduct(productId);
  if (!product) {
    await interaction.reply({ content: '❌ Product not found.', ephemeral: true });
    return;
  }
  await interaction.reply({
    embeds: [buildProductEmbed(product)],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${NEXUS_IDS.BUY}:${product.id}`)
          .setLabel('Αγορά')
          .setEmoji('🛒')
          .setStyle(ButtonStyle.Success),
      ),
    ],
    ephemeral: true,
  });
}
