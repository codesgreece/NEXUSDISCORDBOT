import { ChannelType, EmbedBuilder, Guild } from 'discord.js';
import { BRAND } from '../config/serverStructure';
import { listReviews } from '../db/controlRepository';
import { listProducts } from '../db/shopProductRepository';
import { listOrdersForGuild } from '../db/shopOrderRepository';

export function buildStatsEmbed(guild: Guild): EmbedBuilder {
  const members = guild.memberCount;
  const channels = guild.channels.cache.size;
  const roles = guild.roles.cache.filter((r) => r.id !== guild.id).size;
  const boosts = guild.premiumSubscriptionCount ?? 0;
  const products = listProducts({ activeOnly: true }).length;
  const orders = listOrdersForGuild(guild.id, 100).length;
  const openTickets = guild.channels.cache.filter(
    (c) =>
      (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
      c.name.toLowerCase().startsWith('ticket-'),
  ).size;
  const reviews = listReviews(guild.id).length;

  return new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle(`📊 Statistics · ${guild.name}`)
    .setThumbnail(guild.iconURL({ size: 128 }))
    .setDescription('Στιγμιότυπο κατάστασης server & shop.')
    .addFields(
      { name: '👥 Members', value: String(members), inline: true },
      { name: '📁 Channels', value: String(channels), inline: true },
      { name: '🎭 Roles', value: String(roles), inline: true },
      { name: '🚀 Boosts', value: String(boosts), inline: true },
      { name: '🛍️ Products', value: String(products), inline: true },
      { name: '🧾 Orders', value: String(orders), inline: true },
      { name: '🎫 Open tickets', value: String(openTickets), inline: true },
      { name: '⭐ Reviews', value: String(reviews), inline: true },
    )
    .setFooter({ text: BRAND.name })
    .setTimestamp();
}
