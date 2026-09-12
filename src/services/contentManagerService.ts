import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { BRAND } from '../config/serverStructure';
import { NEXUS_IDS, getShopCategories } from '../config/contentMapping';
import { getStaffRoles } from '../utils/discord';
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from '../db/shopProductRepository';
import { syncProductToDiscord, syncShopToDiscord } from './discordShopSyncService';

export function isStaffOrAdmin(member: GuildMember): boolean {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const staff = getStaffRoles(member.guild);
  return staff.some((role) => member.roles.cache.has(role.id));
}

function rootEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('NEXUS CONTENT MANAGER')
    .setDescription(
      [
        '```',
        '╔════════════════════════════════╗',
        '       NEXUS CONTENT MANAGER',
        '╚════════════════════════════════╝',
        '```',
        'Διαχείριση προϊόντων & sync στο Discord **χωρίς Cursor**.',
      ].join('\n'),
    )
    .setFooter({ text: BRAND.name });
}

function rootRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(NEXUS_IDS.CONTENT_ANNOUNCEMENTS)
        .setLabel('Announcements')
        .setEmoji('📢')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(NEXUS_IDS.CONTENT_PRODUCTS)
        .setLabel('Products')
        .setEmoji('🛍️')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(NEXUS_IDS.CONTENT_PAGES)
        .setLabel('Pages')
        .setEmoji('📄')
        .setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(NEXUS_IDS.CONTENT_REVIEWS)
        .setLabel('Reviews')
        .setEmoji('⭐')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(NEXUS_IDS.CONTENT_PROJECTS)
        .setLabel('Projects')
        .setEmoji('🚀')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(NEXUS_IDS.CONTENT_SYNC)
        .setLabel('Sync')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

function productRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(NEXUS_IDS.PRODUCT_NEW)
        .setLabel('New Product')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(NEXUS_IDS.PRODUCT_EDIT)
        .setLabel('Edit Product')
        .setEmoji('✏️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(NEXUS_IDS.PRODUCT_DELETE)
        .setLabel('Delete Product')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(NEXUS_IDS.PRODUCT_TOGGLE)
        .setLabel('Enable/Disable')
        .setEmoji('🟢')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(NEXUS_IDS.PRODUCT_SYNC)
        .setLabel('Update Discord')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(NEXUS_IDS.CONTENT_ROOT)
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

export async function openContentManager(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!member || !isStaffOrAdmin(member)) {
    const msg = { content: '❌ Μόνο administrators/staff.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
    else await interaction.reply(msg);
    return;
  }

  if (interaction.isButton()) {
    await interaction.update({ embeds: [rootEmbed()], components: rootRows() });
    return;
  }
  await interaction.reply({
    embeds: [rootEmbed()],
    components: rootRows(),
    ephemeral: true,
  });
}

export async function openProductManager(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!member || !isStaffOrAdmin(member)) {
    const msg = { content: '❌ Μόνο administrators/staff.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
    else await interaction.reply(msg);
    return;
  }

  const products = listProducts();
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('🛍️ Product Management')
    .setDescription(
      products.length
        ? products
            .slice(0, 25)
            .map(
              (p) =>
                `${p.active ? '🟢' : '🔴'} ${p.emoji} **${p.name}** — ${
                  p.price === null ? 'Τιμή σύντομα' : `€${p.price.toFixed(2)}`
                } · \`${p.category}\``,
            )
            .join('\n')
        : 'Δεν υπάρχουν προϊόντα.',
    )
    .setFooter({ text: BRAND.name });

  if (interaction.isButton()) {
    await interaction.update({ embeds: [embed], components: productRows() });
    return;
  }
  await interaction.reply({
    embeds: [embed],
    components: productRows(),
    ephemeral: true,
  });
}

async function runSync(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const result = await syncShopToDiscord(interaction.guild!);
  await interaction.editReply({
    content: [
      '🔄 **Sync complete**',
      `Categories: **${result.categories}**`,
      `Products synced: **${result.productsSynced}**`,
      `Failed: **${result.productsFailed}**`,
      result.errors.length ? `\n${result.errors.slice(0, 10).join('\n')}` : '',
    ].join('\n'),
  });
}

export async function handleContentButton(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!member || !isStaffOrAdmin(member)) {
    await interaction.reply({ content: '❌ Staff only.', ephemeral: true });
    return;
  }

  const id = interaction.customId;

  if (id === NEXUS_IDS.CONTENT_ROOT) {
    await interaction.update({ embeds: [rootEmbed()], components: rootRows() });
    return;
  }

  if (id === NEXUS_IDS.CONTENT_PRODUCTS) {
    await openProductManager(interaction);
    return;
  }

  if (
    id === NEXUS_IDS.CONTENT_ANNOUNCEMENTS ||
    id === NEXUS_IDS.CONTENT_PAGES ||
    id === NEXUS_IDS.CONTENT_REVIEWS ||
    id === NEXUS_IDS.CONTENT_PROJECTS
  ) {
    await interaction.reply({
      content:
        '📄 Page editors: χρησιμοποιήστε το Dashboard embed editor προς το παρόν. **Products + Sync** δουλεύουν fully από Discord.',
      ephemeral: true,
    });
    return;
  }

  if (id === NEXUS_IDS.CONTENT_SYNC || id === NEXUS_IDS.PRODUCT_SYNC) {
    await runSync(interaction);
    return;
  }

  if (id === NEXUS_IDS.PRODUCT_NEW) {
    const modal = new ModalBuilder()
      .setCustomId(NEXUS_IDS.PRODUCT_MODAL_CREATE)
      .setTitle('New Product')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Product Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(800),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('price')
            .setLabel('Price (empty = soon)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(16),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('emoji')
            .setLabel('Emoji')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(16)
            .setValue('🤖'),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('image')
            .setLabel('Image URL (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(300),
        ),
      );
    await interaction.showModal(modal);
    return;
  }

  if (
    id === NEXUS_IDS.PRODUCT_EDIT ||
    id === NEXUS_IDS.PRODUCT_DELETE ||
    id === NEXUS_IDS.PRODUCT_TOGGLE
  ) {
    const products = listProducts().slice(0, 25);
    if (!products.length) {
      await interaction.reply({ content: 'No products.', ephemeral: true });
      return;
    }
    const selectId =
      id === NEXUS_IDS.PRODUCT_EDIT
        ? NEXUS_IDS.PRODUCT_SELECT_EDIT
        : id === NEXUS_IDS.PRODUCT_DELETE
          ? NEXUS_IDS.PRODUCT_SELECT_DELETE
          : NEXUS_IDS.PRODUCT_SELECT_TOGGLE;
    const menu = new StringSelectMenuBuilder()
      .setCustomId(selectId)
      .setPlaceholder('Select product…')
      .addOptions(
        products.map((p) => ({
          label: p.name.slice(0, 100),
          value: p.id,
          emoji: p.emoji || undefined,
          description: `${p.active ? 'ON' : 'OFF'} · ${
            p.price === null ? 'Τιμή σύντομα' : `€${p.price.toFixed(2)}`
          }`.slice(0, 100),
        })),
      );
    await interaction.reply({
      content: 'Επίλεξε προϊόν:',
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
      ephemeral: true,
    });
  }
}

function parsePrice(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return 'invalid';
  return Math.round(n * 100) / 100;
}

export async function handleContentModal(interaction: ModalSubmitInteraction): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!member || !isStaffOrAdmin(member)) {
    await interaction.reply({ content: '❌ Staff only.', ephemeral: true });
    return;
  }

  if (interaction.customId === NEXUS_IDS.PRODUCT_MODAL_CREATE) {
    const name = interaction.fields.getTextInputValue('name').trim();
    const description = interaction.fields.getTextInputValue('description').trim();
    const price = parsePrice(interaction.fields.getTextInputValue('price'));
    if (price === 'invalid') {
      await interaction.reply({ content: '❌ Invalid price.', ephemeral: true });
      return;
    }
    const emoji = interaction.fields.getTextInputValue('emoji').trim() || '🤖';
    const image = interaction.fields.getTextInputValue('image').trim() || null;

    const product = createProduct({
      name,
      description,
      price,
      emoji,
      imageUrl: image,
      category: 'DISCORD_BOTS',
    });

    const cats = getShopCategories();
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`${NEXUS_IDS.PRODUCT_CAT_CREATE}:${product.id}`)
      .setPlaceholder('Select category…')
      .addOptions(
        cats.map((c) => ({
          label: c.name,
          value: c.key,
          emoji: c.emoji,
        })),
      );

    await interaction.reply({
      content: `✅ Αποθηκεύτηκε **${product.name}**. Επίλεξε κατηγορία (Discord channel):`,
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
      ephemeral: true,
    });
    return;
  }

  if (interaction.customId.startsWith(`${NEXUS_IDS.PRODUCT_MODAL_EDIT}:`)) {
    const productId = interaction.customId.slice(`${NEXUS_IDS.PRODUCT_MODAL_EDIT}:`.length);
    const name = interaction.fields.getTextInputValue('name').trim();
    const description = interaction.fields.getTextInputValue('description').trim();
    const price = parsePrice(interaction.fields.getTextInputValue('price'));
    if (price === 'invalid') {
      await interaction.reply({ content: '❌ Invalid price.', ephemeral: true });
      return;
    }
    const emoji = interaction.fields.getTextInputValue('emoji').trim() || '🤖';
    const image = interaction.fields.getTextInputValue('image').trim() || null;
    const updated = updateProduct(productId, {
      name,
      description,
      price,
      emoji,
      imageUrl: image,
    });
    if (!updated) {
      await interaction.reply({ content: '❌ Not found.', ephemeral: true });
      return;
    }
    await syncProductToDiscord(interaction.guild!, updated);
    await interaction.reply({
      content: `✅ Updated **${updated.name}** + Discord sync.`,
      ephemeral: true,
    });
  }
}

export async function handleContentSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!member || !isStaffOrAdmin(member)) {
    await interaction.reply({ content: '❌ Staff only.', ephemeral: true });
    return;
  }

  const id = interaction.customId;
  const value = interaction.values[0];

  if (id.startsWith(`${NEXUS_IDS.PRODUCT_CAT_CREATE}:`)) {
    const productId = id.slice(`${NEXUS_IDS.PRODUCT_CAT_CREATE}:`.length);
    const updated = updateProduct(productId, { category: value });
    if (!updated) {
      await interaction.update({ content: '❌ Product missing.', components: [] });
      return;
    }
    const sync = await syncProductToDiscord(interaction.guild!, updated);
    await interaction.update({
      content: sync.ok
        ? `✅ **${updated.name}** → \`${value}\` και ενημερώθηκε το Discord.`
        : `⚠️ Saved but Discord sync failed: ${sync.error}`,
      components: [],
    });
    return;
  }

  if (id === NEXUS_IDS.PRODUCT_SELECT_EDIT) {
    const product = getProduct(value);
    if (!product) {
      await interaction.update({ content: 'Not found.', components: [] });
      return;
    }
    const modal = new ModalBuilder()
      .setCustomId(`${NEXUS_IDS.PRODUCT_MODAL_EDIT}:${product.id}`)
      .setTitle('Edit Product')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Product Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(product.name.slice(0, 100)),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setValue(product.description.slice(0, 800) || '—'),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('price')
            .setLabel('Price (empty = soon)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(product.price === null ? '' : String(product.price)),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('emoji')
            .setLabel('Emoji')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(product.emoji || '🤖'),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('image')
            .setLabel('Image URL')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue((product.imageUrl || '').slice(0, 300)),
        ),
      );
    await interaction.showModal(modal);
    return;
  }

  if (id === NEXUS_IDS.PRODUCT_SELECT_DELETE) {
    const product = getProduct(value);
    if (!product) {
      await interaction.update({ content: 'Not found.', components: [] });
      return;
    }
    const categoryKey = product.category;
    deleteProduct(value);
    if (interaction.guild) {
      try {
        const { syncCategoryPanel } = await import('./discordShopSyncService');
        await syncCategoryPanel(interaction.guild, categoryKey);
      } catch {
        // panel refresh best-effort
      }
    }
    await interaction.update({
      content: `🗑️ Deleted **${product.name}** και ενημερώθηκε το shop panel.`,
      components: [],
    });
    return;
  }

  if (id === NEXUS_IDS.PRODUCT_SELECT_TOGGLE) {
    const product = getProduct(value);
    if (!product) {
      await interaction.update({ content: 'Not found.', components: [] });
      return;
    }
    const updated = updateProduct(value, { active: !product.active })!;
    await syncProductToDiscord(interaction.guild!, updated);
    await interaction.update({
      content: `${updated.active ? '🟢 Enabled' : '🔴 Disabled'} **${updated.name}**`,
      components: [],
    });
  }
}
