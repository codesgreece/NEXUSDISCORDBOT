import {
  ButtonInteraction,
  ChannelType,
  Guild,
  GuildMember,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import {
  BRAND,
  CUSTOM_IDS,
  TICKET_TYPES,
  TicketType,
} from '../config/serverStructure';
import {
  findCategoryByName,
  getStaffRoles,
  sanitizeUsername,
} from '../utils/discord';
import {
  createDeleteConfirmButtons,
  createTicketActionButtons,
  createTicketEmbed,
} from '../utils/embeds';
import { logError, logEvent } from './loggingService';

const TICKET_TYPE_BY_CUSTOM_ID: Record<string, TicketType> = {
  [CUSTOM_IDS.TICKET_WEBSITE]: 'website',
  [CUSTOM_IDS.TICKET_BOT]: 'bot',
  [CUSTOM_IDS.TICKET_PRICING]: 'pricing',
  [CUSTOM_IDS.TICKET_SUPPORT]: 'support',
  [CUSTOM_IDS.TICKET_PARTNERSHIP]: 'partnership',
};

function isStaffMember(member: GuildMember): boolean {
  const staffRoles = getStaffRoles(member.guild);
  return staffRoles.some((role) => member.roles.cache.has(role.id)) ||
    member.permissions.has(PermissionFlagsBits.Administrator);
}

function userHasOpenTicket(guild: Guild, userId: string): TextChannel | undefined {
  return guild.channels.cache.find((channel) => {
    if (channel.type !== ChannelType.GuildText) return false;
    if (!channel.name.startsWith('ticket-')) return false;
    // Closed tickets keep the channel but deny the user — still count as open until deleted
    const overwrite = channel.permissionOverwrites.cache.get(userId);
    return overwrite?.allow.has(PermissionFlagsBits.ViewChannel) === true;
  }) as TextChannel | undefined;
}

export async function handleTicketCreate(interaction: ButtonInteraction): Promise<void> {
  const type = TICKET_TYPE_BY_CUSTOM_ID[interaction.customId];
  if (!type) return;

  const guild = interaction.guild;
  if (!guild || !interaction.member) {
    await interaction.reply({ content: '❌ Tickets can only be created in a server.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const existing = userHasOpenTicket(guild, interaction.user.id);
    if (existing) {
      await interaction.editReply({
        content: `❌ You already have an open ticket: ${existing}`,
      });
      return;
    }

    const ticketMeta = TICKET_TYPES[type];
    const safeName = sanitizeUsername(interaction.user.username);
    const channelName = `${ticketMeta.prefix}-${safeName}`.slice(0, 100);

    const supportCategory =
      findCategoryByName(guild, '🎫 SUPPORT') ?? findCategoryByName(guild, '🔒 STAFF');

    const staffRoles = getStaffRoles(guild);
    const overwrites = [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
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

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: supportCategory?.id,
      topic: `Ticket (${ticketMeta.label}) for ${interaction.user.tag} | uid:${interaction.user.id}`,
      permissionOverwrites: overwrites,
      reason: `Ticket created by ${interaction.user.tag}`,
    });

    const createdAt = new Date();
    await channel.send({
      content: `${interaction.user} — Staff will assist you shortly.`,
      embeds: [
        createTicketEmbed(
          `${ticketMeta.emoji} ${ticketMeta.label}`,
          interaction.user.tag,
          interaction.user.id,
          createdAt,
        ),
      ],
      components: [createTicketActionButtons()],
    });

    await logEvent(guild, {
      title: 'Ticket Created',
      description: `A new **${ticketMeta.label}** ticket was opened.`,
      color: BRAND.success,
      fields: [
        { name: 'User', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
        { name: 'Channel', value: `${channel}`, inline: true },
        { name: 'Type', value: ticketMeta.label, inline: true },
      ],
    });

    await interaction.editReply({
      content: `✅ Your ticket has been created: ${channel}`,
    });
  } catch (error) {
    await logError(guild, error, 'ticket:create');
    await interaction.editReply({
      content: '❌ Failed to create your ticket. Please try again or contact staff.',
    });
  }
}

export async function handleTicketClose(interaction: ButtonInteraction): Promise<void> {
  const channel = interaction.channel;
  const guild = interaction.guild;

  if (!guild || !channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: '❌ This action is only available in ticket channels.', ephemeral: true });
    return;
  }

  if (!channel.name.startsWith('ticket-')) {
    await interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  const topicUid = channel.topic?.match(/uid:(\d+)/)?.[1];
  const isOwner = topicUid === interaction.user.id;
  const staff = isStaffMember(member);

  if (!isOwner && !staff) {
    await interaction.reply({ content: '❌ You cannot close this ticket.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    if (topicUid) {
      await channel.permissionOverwrites.edit(topicUid, {
        ViewChannel: false,
        SendMessages: false,
      });
    }

    // Rename to indicate closed (keep under 100 chars)
    if (!channel.name.startsWith('closed-')) {
      const newName = `closed-${channel.name}`.slice(0, 100);
      await channel.setName(newName).catch(() => undefined);
    }

    await channel.send({
      embeds: [
        {
          color: BRAND.warning,
          title: '🔒 Ticket Closed',
          description: `Closed by <@${interaction.user.id}>. The user no longer has access. Staff can delete this ticket when ready.`,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    await logEvent(guild, {
      title: 'Ticket Closed',
      description: `Ticket channel ${channel} was closed.`,
      color: BRAND.warning,
      fields: [
        { name: 'Closed by', value: `${interaction.user.tag}`, inline: true },
        { name: 'Channel', value: channel.name, inline: true },
      ],
    });

    await interaction.editReply({ content: '✅ Ticket closed. User access has been removed.' });
  } catch (error) {
    await logError(guild, error, 'ticket:close');
    await interaction.editReply({ content: '❌ Failed to close the ticket.' });
  }
}

export async function handleTicketDeleteRequest(interaction: ButtonInteraction): Promise<void> {
  const channel = interaction.channel;
  const guild = interaction.guild;

  if (!guild || !channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: '❌ This action is only available in ticket channels.', ephemeral: true });
    return;
  }

  if (!channel.name.includes('ticket-')) {
    await interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!isStaffMember(member)) {
    await interaction.reply({
      content: '❌ Only staff can delete tickets.',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: '⚠️ Are you sure you want to **permanently delete** this ticket channel?',
    components: [createDeleteConfirmButtons()],
    ephemeral: true,
  });
}

export async function handleTicketDeleteConfirm(interaction: ButtonInteraction): Promise<void> {
  const channel = interaction.channel;
  const guild = interaction.guild;

  if (!guild || !channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: '❌ Invalid channel.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!isStaffMember(member)) {
    await interaction.reply({ content: '❌ Only staff can delete tickets.', ephemeral: true });
    return;
  }

  await interaction.update({
    content: '🗑️ Deleting ticket...',
    components: [],
  });

  const channelName = channel.name;

  try {
    await logEvent(guild, {
      title: 'Ticket Deleted',
      description: `Ticket channel \`${channelName}\` was deleted.`,
      color: BRAND.danger,
      fields: [
        { name: 'Deleted by', value: `${interaction.user.tag}`, inline: true },
        { name: 'Channel', value: channelName, inline: true },
      ],
    });

    await channel.delete(`Ticket deleted by ${interaction.user.tag}`);
  } catch (error) {
    await logError(guild, error, 'ticket:delete');
    try {
      await interaction.followUp({ content: '❌ Failed to delete the ticket.', ephemeral: true });
    } catch {
      // Channel may already be gone
    }
  }
}

export async function handleTicketDeleteCancel(interaction: ButtonInteraction): Promise<void> {
  await interaction.update({
    content: '✅ Deletion cancelled.',
    components: [],
  });
}

export function isTicketButton(customId: string): boolean {
  return customId.startsWith('ticket:');
}

export async function routeTicketButton(interaction: ButtonInteraction): Promise<void> {
  switch (interaction.customId) {
    case CUSTOM_IDS.TICKET_WEBSITE:
    case CUSTOM_IDS.TICKET_BOT:
    case CUSTOM_IDS.TICKET_PRICING:
    case CUSTOM_IDS.TICKET_SUPPORT:
    case CUSTOM_IDS.TICKET_PARTNERSHIP:
      await handleTicketCreate(interaction);
      break;
    case CUSTOM_IDS.TICKET_CLOSE:
      await handleTicketClose(interaction);
      break;
    case CUSTOM_IDS.TICKET_DELETE:
      await handleTicketDeleteRequest(interaction);
      break;
    case CUSTOM_IDS.TICKET_DELETE_CONFIRM:
      await handleTicketDeleteConfirm(interaction);
      break;
    case CUSTOM_IDS.TICKET_DELETE_CANCEL:
      await handleTicketDeleteCancel(interaction);
      break;
    default:
      break;
  }
}
