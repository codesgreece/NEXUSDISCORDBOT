import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { getClient } from '../bot/client';
import { BRAND } from '../config/serverStructure';
import { findCategoryByName, getStaffRoles, sanitizeUsername } from '../utils/discord';
import { logEvent, logError } from './loggingService';
import type { ShopOrder } from '../db/shopOrderRepository';
import { updateOrderStatus } from '../db/shopOrderRepository';

function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return 'Contact for quote';
  return `€${price.toFixed(2)}`;
}

export async function createOrderTicket(order: ShopOrder): Promise<{ channelId: string }> {
  const client = getClient();
  const guild = client.guilds.cache.get(order.guildId);
  if (!guild) {
    throw new Error('Bot is not in this server — cannot create order ticket.');
  }

  const supportCategory =
    findCategoryByName(guild, '🎫 SUPPORT') ??
    findCategoryByName(guild, '🔒 STAFF') ??
    findCategoryByName(guild, 'SUPPORT');

  const staffRoles = getStaffRoles(guild);
  const safeName = sanitizeUsername(order.userTag.split('#')[0] || order.userId);
  const channelName = `order-${safeName}-${order.id.slice(-6).toLowerCase()}`.slice(0, 100);

  const overwrites = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: order.userId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    ...staffRoles.map((role) => ({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
      ],
    })),
  ];

  const me = guild.members.me;
  if (me) {
    overwrites.push({
      id: me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  let channel: TextChannel;
  try {
    channel = (await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: supportCategory?.id,
      topic: `Shop order ${order.id} | uid:${order.userId}`,
      permissionOverwrites: overwrites,
      reason: `Shop order ${order.id}`,
    })) as TextChannel;
  } catch (error) {
    await logError(guild, error, 'shop:createOrderTicket');
    throw new Error('Failed to create Discord order ticket channel.');
  }

  const lines = order.items.map((item) => {
    const unit = formatPrice(item.unitPrice);
    const line = formatPrice(item.lineTotal);
    return `${item.productEmoji} **${item.productName}** × ${item.quantity} — ${unit} (line: ${line})`;
  });

  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('🛒 New Bot Shop Order')
    .setDescription('A customer checked out from the NEXUS Dashboard Bot Shop.')
    .addFields(
      { name: 'Order ID', value: `\`${order.id}\``, inline: true },
      { name: 'Customer', value: `<@${order.userId}>\n${order.userTag}`, inline: true },
      {
        name: 'Total',
        value: order.total === null ? 'Contact for quote' : `**€${order.total.toFixed(2)}**`,
        inline: true,
      },
      {
        name: 'Products',
        value: lines.join('\n').slice(0, 1024) || '—',
      },
    )
    .setFooter({ text: `${BRAND.name} · Bot Shop` })
    .setTimestamp();

  await channel.send({
    content: `<@${order.userId}> — Staff will review your order shortly.`,
    embeds: [embed],
  });

  updateOrderStatus(order.id, {
    status: 'ticket_created',
    ticketChannelId: channel.id,
  });

  await logEvent(guild, {
    title: 'Shop order created',
    description: `Order \`${order.id}\` · ${order.items.length} item(s) · ${formatPrice(order.total)}`,
    color: BRAND.accent,
    actorId: order.userId,
    actorTag: order.userTag,
    fields: [
      { name: 'Customer', value: `<@${order.userId}>`, inline: true },
      { name: 'Channel', value: `${channel}`, inline: true },
      { name: 'Total', value: formatPrice(order.total), inline: true },
    ],
  });

  return { channelId: channel.id };
}
