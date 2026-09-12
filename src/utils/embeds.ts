import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { BRAND, CUSTOM_IDS } from '../config/serverStructure';

export function createWelcomeEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle(BRAND.name)
    .setDescription(
      [
        `**${BRAND.tagline}**`,
        '',
        'Welcome to our professional development community.',
        '',
        '🌐 **Website Development**',
        '🤖 **Discord Bot Development**',
        '🎨 **Web Design**',
        '⚙️ **Custom Solutions**',
        '🛠️ **Support**',
        '',
        'For orders or inquiries, please use the ticket system.',
      ].join('\n'),
    )
    .setFooter({ text: BRAND.name })
    .setTimestamp();
}

export function createRulesEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND.color)
    .setTitle('📜 Server Rules')
    .setDescription(
      [
        'Please read and follow these rules to keep the community safe and professional.',
        '',
        '**1.** Respect all members and staff.',
        '**2.** No spam or excessive advertising.',
        '**3.** No harassment or discrimination.',
        '**4.** Do not abuse support or ticket systems.',
        '**5.** Do not share malicious files or links.',
        '**6.** Follow Discord Terms of Service.',
        '**7.** Staff decisions regarding moderation are final.',
      ].join('\n'),
    )
    .setFooter({ text: BRAND.name })
    .setTimestamp();
}

export function createServicesEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('💼 Our Services')
    .setDescription('Professional digital solutions tailored to your needs.')
    .addFields(
      {
        name: '🌐 WEBSITE DEVELOPMENT',
        value: 'Modern, responsive and professional websites.',
      },
      {
        name: '🤖 DISCORD BOT DEVELOPMENT',
        value: 'Custom Discord bots, automation, moderation, tickets and integrations.',
      },
      {
        name: '🎨 WEB DESIGN',
        value: 'Modern UI/UX design and custom visual experiences.',
      },
      {
        name: '⚙️ CUSTOM SOLUTIONS',
        value: 'Custom digital tools and integrations.',
      },
      {
        name: '🛠️ MAINTENANCE & SUPPORT',
        value: 'Ongoing updates, fixes and technical support.',
      },
    )
    .setFooter({ text: BRAND.name })
    .setTimestamp();
}

export function createPricingEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND.warning)
    .setTitle('💰 CUSTOM PRICING')
    .setDescription(
      [
        'Every project is different.',
        '',
        'Pricing depends on:',
        '• Project requirements',
        '• Features',
        '• Design complexity',
        '• Development time',
        '• Integrations',
        '• Maintenance requirements',
        '',
        'Open a ticket to receive a custom quote.',
      ].join('\n'),
    )
    .setFooter({ text: BRAND.name })
    .setTimestamp();
}

export function createTicketPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('🎫 NEXUS SUPPORT')
    .setDescription(
      [
        'Need a website, Discord bot or custom solution?',
        '',
        'Open a ticket and tell us what you need.',
        '',
        'Select a category below to get started.',
      ].join('\n'),
    )
    .setFooter({ text: BRAND.name })
    .setTimestamp();
}

export function createTicketPanelButtons(): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.TICKET_WEBSITE)
      .setLabel('Website')
      .setEmoji('🌐')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.TICKET_BOT)
      .setLabel('Discord Bot')
      .setEmoji('🤖')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.TICKET_PRICING)
      .setLabel('Pricing')
      .setEmoji('💰')
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.TICKET_SUPPORT)
      .setLabel('Support')
      .setEmoji('🛠️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.TICKET_PARTNERSHIP)
      .setLabel('Partnership')
      .setEmoji('🤝')
      .setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2];
}

export function createTicketEmbed(
  typeLabel: string,
  userTag: string,
  userId: string,
  createdAt: Date,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('🎫 Support Ticket')
    .addFields(
      { name: 'Type', value: typeLabel, inline: true },
      { name: 'User', value: `<@${userId}> (${userTag})`, inline: true },
      {
        name: 'Created at',
        value: `<t:${Math.floor(createdAt.getTime() / 1000)}:F>`,
        inline: false,
      },
    )
    .setFooter({ text: BRAND.name })
    .setTimestamp();
}

export function createTicketActionButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.TICKET_CLOSE)
      .setLabel('Close Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.TICKET_DELETE)
      .setLabel('Delete Ticket')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger),
  );
}

export function createDeleteConfirmButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.TICKET_DELETE_CONFIRM)
      .setLabel('Confirm Delete')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.TICKET_DELETE_CANCEL)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );
}
