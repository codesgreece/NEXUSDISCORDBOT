import {
  ActionRowBuilder,
  APIEmbedField,
  ButtonBuilder,
  ButtonStyle,
  ColorResolvable,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { getClient } from '../bot/client';
import { getGuildConfig, updateGuildConfig } from '../db/guildConfigRepository';
import { findTextChannelByName } from '../utils/discord';
import { recordActivity } from '../db/activityRepository';
import { BRAND, CUSTOM_IDS } from '../config/serverStructure';

export type EmbedKind = 'welcome' | 'rules' | 'services' | 'pricing' | 'ticket';

export interface EmbedFieldInput {
  name: string;
  value: string;
  inline?: boolean;
}

export interface EmbedButtonInput {
  label: string;
  customId: string;
  style?: 'Primary' | 'Secondary' | 'Success' | 'Danger';
  emoji?: string;
}

export interface EmbedPayload {
  title?: string;
  description?: string;
  color?: string;
  authorName?: string;
  authorIconUrl?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  footerText?: string;
  footerIconUrl?: string;
  timestamp?: boolean;
  fields?: EmbedFieldInput[];
  buttons?: EmbedButtonInput[];
}

const CHANNEL_BY_KIND: Record<EmbedKind, string> = {
  welcome: '👋・welcome',
  rules: '📜・rules',
  services: '💼・services',
  pricing: '💰・pricing',
  ticket: '🎫・create-ticket',
};

const MARKER_BY_KIND: Record<EmbedKind, string> = {
  welcome: 'NEXUS_WELCOME_EMBED',
  rules: 'NEXUS_RULES_EMBED',
  services: 'NEXUS_SERVICES_EMBED',
  pricing: 'NEXUS_PRICING_EMBED',
  ticket: 'NEXUS_TICKET_PANEL',
};

const DEFAULTS: Record<Exclude<EmbedKind, 'ticket'>, EmbedPayload> = {
  welcome: {
    title: BRAND.name,
    description: [
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
    color: '#5865F2',
    footerText: BRAND.name,
    timestamp: true,
    fields: [],
  },
  rules: {
    title: '📜 Server Rules',
    description: [
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
    color: '#2B2D31',
    footerText: BRAND.name,
    timestamp: true,
    fields: [],
  },
  services: {
    title: '💼 Our Services',
    description: 'Professional digital solutions tailored to your needs.',
    color: '#5865F2',
    footerText: BRAND.name,
    timestamp: true,
    fields: [
      { name: '🌐 WEBSITE DEVELOPMENT', value: 'Modern, responsive and professional websites.', inline: false },
      { name: '🤖 DISCORD BOT DEVELOPMENT', value: 'Custom Discord bots, automation, moderation, tickets and integrations.', inline: false },
      { name: '🎨 WEB DESIGN', value: 'Modern UI/UX design and custom visual experiences.', inline: false },
      { name: '⚙️ CUSTOM SOLUTIONS', value: 'Custom digital tools and integrations.', inline: false },
      { name: '🛠️ MAINTENANCE & SUPPORT', value: 'Ongoing updates, fixes and technical support.', inline: false },
    ],
  },
  pricing: {
    title: '💰 CUSTOM PRICING',
    description: [
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
    color: '#FEE75C',
    footerText: BRAND.name,
    timestamp: true,
    fields: [],
  },
};

function parseColor(color?: string): ColorResolvable {
  if (!color) return BRAND.accent;
  const cleaned = color.trim();
  if (cleaned.startsWith('#')) return cleaned as ColorResolvable;
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) return `#${cleaned}` as ColorResolvable;
  return BRAND.accent;
}

export function buildEmbedFromPayload(payload: EmbedPayload): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(parseColor(payload.color));
  if (payload.title) embed.setTitle(payload.title.slice(0, 256));
  if (payload.description) embed.setDescription(payload.description.slice(0, 4096));
  if (payload.authorName) {
    embed.setAuthor({
      name: payload.authorName.slice(0, 256),
      iconURL: payload.authorIconUrl || undefined,
    });
  }
  if (payload.thumbnailUrl) embed.setThumbnail(payload.thumbnailUrl);
  if (payload.imageUrl) embed.setImage(payload.imageUrl);
  if (payload.footerText) {
    embed.setFooter({
      text: payload.footerText.slice(0, 2048),
      iconURL: payload.footerIconUrl || undefined,
    });
  }
  if (payload.timestamp) embed.setTimestamp();
  if (payload.fields?.length) {
    const fields: APIEmbedField[] = payload.fields
      .filter((f) => f.name && f.value)
      .slice(0, 25)
      .map((f) => ({
        name: f.name.slice(0, 256),
        value: f.value.slice(0, 1024),
        inline: Boolean(f.inline),
      }));
    if (fields.length) embed.addFields(fields);
  }
  return embed;
}

function buttonStyle(style?: EmbedButtonInput['style']): ButtonStyle {
  switch (style) {
    case 'Secondary':
      return ButtonStyle.Secondary;
    case 'Success':
      return ButtonStyle.Success;
    case 'Danger':
      return ButtonStyle.Danger;
    default:
      return ButtonStyle.Primary;
  }
}

export function buildActionRows(buttons?: EmbedButtonInput[]): ActionRowBuilder<ButtonBuilder>[] {
  if (!buttons?.length) return [];
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const chunk = buttons.slice(0, 25);
  for (let i = 0; i < chunk.length; i += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const btn of chunk.slice(i, i + 5)) {
      const builder = new ButtonBuilder()
        .setCustomId(btn.customId.slice(0, 100))
        .setLabel(btn.label.slice(0, 80))
        .setStyle(buttonStyle(btn.style));
      if (btn.emoji) builder.setEmoji(btn.emoji);
      row.addComponents(builder);
    }
    rows.push(row);
  }
  return rows;
}

function messageIdKey(kind: EmbedKind): keyof ReturnType<typeof getGuildConfig> {
  switch (kind) {
    case 'welcome':
      return 'welcomeMessageId';
    case 'rules':
      return 'rulesMessageId';
    case 'services':
      return 'servicesMessageId';
    case 'pricing':
      return 'pricingMessageId';
    case 'ticket':
      return 'ticketPanelMessageId';
  }
}

async function findMarkedMessage(channel: TextChannel, marker: string) {
  const messages = await channel.messages.fetch({ limit: 50 });
  return messages.find((m) => m.author.bot && m.content.includes(marker)) ?? null;
}

export function getStoredEmbed(guildId: string, kind: EmbedKind): EmbedPayload {
  const config = getGuildConfig(guildId) as ReturnType<typeof getGuildConfig> & Record<string, unknown>;
  const raw = config[`${kind}Embed` as string];
  if (typeof raw === 'string' && raw) {
    try {
      return JSON.parse(raw) as EmbedPayload;
    } catch {
      // fall through
    }
  }
  if (kind === 'ticket') {
    return {
      title: '🎫 NEXUS SUPPORT',
      description: [
        'Need a website, Discord bot or custom solution?',
        '',
        'Open a ticket and tell us what you need.',
        '',
        'Select a category below to get started.',
      ].join('\n'),
      color: '#5865F2',
      footerText: BRAND.name,
      timestamp: true,
      fields: [],
      buttons: [
        { label: 'Website', customId: CUSTOM_IDS.TICKET_WEBSITE, emoji: '🌐', style: 'Primary' },
        { label: 'Discord Bot', customId: CUSTOM_IDS.TICKET_BOT, emoji: '🤖', style: 'Primary' },
        { label: 'Pricing', customId: CUSTOM_IDS.TICKET_PRICING, emoji: '💰', style: 'Secondary' },
        { label: 'Support', customId: CUSTOM_IDS.TICKET_SUPPORT, emoji: '🛠️', style: 'Success' },
        { label: 'Partnership', customId: CUSTOM_IDS.TICKET_PARTNERSHIP, emoji: '🤝', style: 'Secondary' },
      ],
    };
  }
  return structuredClone(DEFAULTS[kind]);
}

export async function getEmbedState(guildId: string, kind: EmbedKind) {
  const channelName = CHANNEL_BY_KIND[kind];
  const client = getClient();
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');

  const channel = findTextChannelByName(guild, channelName);
  const config = getGuildConfig(guildId);
  const payload = getStoredEmbed(guildId, kind);

  return {
    kind,
    channelName,
    channelId: channel?.id ?? null,
    messageId: (config[messageIdKey(kind)] as string | null) ?? null,
    payload,
  };
}

export async function saveEmbedToDiscord(
  guildId: string,
  kind: EmbedKind,
  payload: EmbedPayload,
  actor?: { id: string; tag: string },
) {
  const client = getClient();
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');

  const channel = findTextChannelByName(guild, CHANNEL_BY_KIND[kind]);
  if (!channel) {
    throw new Error(`Channel ${CHANNEL_BY_KIND[kind]} not found. Run /setup first.`);
  }

  const marker = MARKER_BY_KIND[kind];
  const embed = buildEmbedFromPayload(payload);
  const components = kind === 'ticket' ? buildActionRows(payload.buttons) : [];
  const content = `<!-- ${marker} -->`;

  const config = getGuildConfig(guildId);
  const storedId = config[messageIdKey(kind)] as string | null;
  let message = storedId ? await channel.messages.fetch(storedId).catch(() => null) : null;
  if (!message) {
    message = await findMarkedMessage(channel, marker);
  }

  if (message) {
    await message.edit({ content, embeds: [embed], components });
  } else {
    message = await channel.send({ content, embeds: [embed], components });
  }

  const patch: Record<string, unknown> = {
    [`${kind}Embed`]: JSON.stringify(payload),
  };
  // message id fields
  if (kind === 'welcome') patch.welcomeMessageId = message.id;
  if (kind === 'rules') patch.rulesMessageId = message.id;
  if (kind === 'services') patch.servicesMessageId = message.id;
  if (kind === 'pricing') patch.pricingMessageId = message.id;
  if (kind === 'ticket') patch.ticketPanelMessageId = message.id;

  // Persist embed JSON via extended repo helper
  persistEmbedJson(guildId, kind, payload, message.id);

  recordActivity({
    guildId,
    action: 'Embed updated',
    userId: actor?.id,
    userTag: actor?.tag,
    details: `${kind} embed saved to #${channel.name}`,
  });

  return { messageId: message.id, channelId: channel.id, payload };
}

function persistEmbedJson(
  guildId: string,
  kind: EmbedKind,
  payload: EmbedPayload,
  messageId: string,
): void {
  const { getDb } = require('../db') as typeof import('../db');
  const db = getDb();
  const column = `${kind}_embed_json`;
  const messageColumn = `${kind === 'ticket' ? 'ticket_panel' : kind}_message_id`;
  // ensure columns exist
  ensureEmbedColumns();
  db.prepare(
    `UPDATE guild_configs SET ${column} = ?, ${messageColumn} = ?, updated_at = ? WHERE guild_id = ?`,
  ).run(JSON.stringify(payload), messageId, new Date().toISOString(), guildId);
}

let embedColumnsReady = false;
export function ensureEmbedColumns(): void {
  if (embedColumnsReady) return;
  const { getDb } = require('../db') as typeof import('../db');
  const db = getDb();
  const cols = (
    db.prepare(`PRAGMA table_info(guild_configs)`).all() as Array<{ name: string }>
  ).map((c) => c.name);

  const needed = [
    'welcome_embed_json',
    'rules_embed_json',
    'services_embed_json',
    'pricing_embed_json',
    'ticket_embed_json',
  ];
  for (const col of needed) {
    if (!cols.includes(col)) {
      db.exec(`ALTER TABLE guild_configs ADD COLUMN ${col} TEXT`);
    }
  }
  embedColumnsReady = true;
}

export function loadEmbedJson(guildId: string, kind: EmbedKind): EmbedPayload | null {
  ensureEmbedColumns();
  const { getDb } = require('../db') as typeof import('../db');
  const db = getDb();
  const column = `${kind}_embed_json`;
  const row = db
    .prepare(`SELECT ${column} as data FROM guild_configs WHERE guild_id = ?`)
    .get(guildId) as { data?: string } | undefined;
  if (!row?.data) return null;
  try {
    return JSON.parse(row.data) as EmbedPayload;
  } catch {
    return null;
  }
}

// Fix getStoredEmbed to use loadEmbedJson
export function getEmbedPayload(guildId: string, kind: EmbedKind): EmbedPayload {
  ensureEmbedColumns();
  const stored = loadEmbedJson(guildId, kind);
  if (stored) return stored;
  return getStoredEmbed(guildId, kind);
}
