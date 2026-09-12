import {
  CategoryChannel,
  ChannelType,
  ChatInputCommandInteraction,
  Guild,
  PermissionFlagsBits,
  Role,
  TextChannel,
} from 'discord.js';
import {
  BRAND,
  CATEGORIES,
  ROLES,
} from '../config/serverStructure';
import {
  buildStaffOverwrites,
  findCategoryByName,
  findChannelByName,
  findRoleByName,
  findTextChannelByName,
  getStaffRoles,
  sleep,
} from '../utils/discord';
import {
  createPricingEmbed,
  createRulesEmbed,
  createServicesEmbed,
  createTicketPanelButtons,
  createTicketPanelEmbed,
  createWelcomeEmbed,
} from '../utils/embeds';
import { logEvent } from './loggingService';
import {
  MANAGED_EMBED_MARKERS,
  publishManagedEmbed,
  type ManagedEmbedKey,
} from './managedEmbedService';
import { getGuildConfig, updateGuildConfig } from '../db/guildConfigRepository';

const REQUIRED_BOT_PERMISSIONS = [
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.ManageMessages,
] as const;

type ProgressFn = (message: string) => Promise<void>;

export async function runSetup(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: '❌ This command can only be used in a server.' });
    return;
  }

  const member = interaction.member;
  if (!member || typeof member.permissions === 'string') {
    await interaction.editReply({ content: '❌ Could not verify your permissions.' });
    return;
  }

  if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({
      content: '❌ You need the **Administrator** permission to run `/setup`.',
    });
    return;
  }

  const me = guild.members.me;
  if (!me) {
    await interaction.editReply({ content: '❌ Could not resolve the bot member.' });
    return;
  }

  const missing = REQUIRED_BOT_PERMISSIONS.filter((perm) => !me.permissions.has(perm));
  if (missing.length > 0) {
    await interaction.editReply({
      content:
        '❌ The bot is missing required permissions. Please grant **Administrator** (or Manage Channels, Manage Roles, Send Messages, Embed Links, Manage Messages) and try again.',
    });
    return;
  }

  const progress: ProgressFn = async (message: string) => {
    try {
      await interaction.editReply({ content: message });
    } catch {
      // Ignore edit failures during long setups
    }
  };

  try {
    await progress('🔄 **Setup started...**\n\n⏳ Creating roles...');
    const roles = await createRoles(guild, progress);

    await progress('🔄 **Setup in progress...**\n\n✅ Roles ready\n⏳ Creating categories & channels...');
    await createCategoriesAndChannels(guild, progress);

    await progress(
      '🔄 **Setup in progress...**\n\n✅ Roles ready\n✅ Channels ready\n⏳ Configuring staff permissions...',
    );
    await applyStaffPermissions(guild);

    await progress(
      '🔄 **Setup in progress...**\n\n✅ Roles ready\n✅ Channels ready\n✅ Permissions ready\n⏳ Sending information embeds...',
    );
    await sendInformationEmbeds(guild);

    // Ensure bot has the Bot role and sits correctly in hierarchy
    const botRole = roles.get('🤖 Bot');
    if (botRole && !me.roles.cache.has(botRole.id)) {
      try {
        await me.roles.add(botRole);
      } catch {
        // Bot role may be higher than the bot's highest role — non-fatal
      }
    }

    await logEvent(guild, {
      title: 'Setup Executed',
      description: `Server setup completed by <@${interaction.user.id}>.`,
      color: BRAND.success,
      actorId: interaction.user.id,
      actorTag: interaction.user.tag,
      fields: [
        { name: 'User', value: `${interaction.user.tag}`, inline: true },
        { name: 'Guild', value: guild.name, inline: true },
      ],
    });

    await progress(
      [
        '✅ **Setup completed successfully!**',
        '',
        'Created / verified:',
        `• **${ROLES.length}** roles`,
        `• **${CATEGORIES.length}** categories`,
        `• **${CATEGORIES.reduce((n, c) => n + c.channels.length, 0)}** channels`,
        '• Information embeds (welcome, rules, services, pricing, tickets)',
        '• Staff-only channel permissions',
        '',
        'You can safely run `/setup` again — it will skip existing items.',
      ].join('\n'),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SETUP] Error:', error);

    await logEvent(guild, {
      title: 'Setup Error',
      description: `An error occurred during setup.\n\`\`\`${message}\`\`\``,
      color: BRAND.danger,
      fields: [{ name: 'User', value: interaction.user.tag, inline: true }],
    }).catch(() => undefined);

    await interaction.editReply({
      content: `❌ Setup failed: ${message}\n\nExisting channels/roles were not removed. Fix the issue and run \`/setup\` again.`,
    });
  }
}

async function createRoles(
  guild: Guild,
  progress: ProgressFn,
): Promise<Map<string, Role>> {
  const created = new Map<string, Role>();

  // Create from lowest position to highest so Discord hierarchy ends correctly
  const sorted = [...ROLES].sort((a, b) => a.position - b.position);

  for (const def of sorted) {
    let role = findRoleByName(guild, def.name);

    if (!role) {
      role = await guild.roles.create({
        name: def.name,
        color: def.color,
        hoist: def.hoist,
        mentionable: def.mentionable,
        reason: 'NEXUS setup: create role',
      });
      await sleep(350);
    } else {
      // Keep existing role in sync with definition (non-destructive)
      try {
        await role.edit({
          color: def.color,
          hoist: def.hoist,
          mentionable: def.mentionable,
          reason: 'NEXUS setup: sync role',
        });
      } catch {
        // Ignore if we lack permission to edit this role
      }
    }

    created.set(def.name, role);
    await progress(`🔄 Creating roles...\n• ${def.name}`);
  }

  // Reorder roles (highest position first in setPositions)
  try {
    const positions = ROLES.map((def) => {
      const role = created.get(def.name);
      return role ? { role: role.id, position: def.position } : null;
    }).filter((p): p is { role: string; position: number } => p !== null);

    if (positions.length > 0) {
      await guild.roles.setPositions(positions);
    }
  } catch (error) {
    console.warn('[SETUP] Could not fully reorder roles (bot role may be too low):', error);
  }

  return created;
}

async function createCategoriesAndChannels(
  guild: Guild,
  progress: ProgressFn,
): Promise<void> {
  for (const categoryDef of CATEGORIES) {
    let category = findCategoryByName(guild, categoryDef.name);

    if (!category) {
      category = await guild.channels.create({
        name: categoryDef.name,
        type: ChannelType.GuildCategory,
        reason: 'NEXUS setup: create category',
      });
      await sleep(350);
    }

    await progress(`🔄 Creating channels...\n📂 ${categoryDef.name}`);

    for (const channelDef of categoryDef.channels) {
      // Prefer channel under the correct category; fall back to any match to avoid duplicates
      let channel =
        findChannelByName(guild, channelDef.name, category.id) ??
        findChannelByName(guild, channelDef.name);

      if (!channel) {
        channel = await guild.channels.create({
          name: channelDef.name,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: channelDef.topic,
          reason: 'NEXUS setup: create channel',
        });
        await sleep(350);
      } else if (channel.parentId !== category.id && 'setParent' in channel) {
        try {
          await channel.setParent(category.id, { lockPermissions: false });
        } catch {
          // Non-fatal
        }
      }
    }
  }
}

async function applyStaffPermissions(guild: Guild): Promise<void> {
  const staffRoles = getStaffRoles(guild);
  if (staffRoles.length === 0) return;

  const overwrites = buildStaffOverwrites(guild, staffRoles);
  const staffCategory = findCategoryByName(guild, '🔒 STAFF') as CategoryChannel | undefined;

  if (staffCategory) {
    await staffCategory.permissionOverwrites.set(overwrites);
  }

  for (const channelDef of CATEGORIES.find((c) => c.name === '🔒 STAFF')?.channels ?? []) {
    const channel = findTextChannelByName(guild, channelDef.name);
    // Staff category has two channels named similarly across categories — match under staff parent
    const staffChannel =
      (staffCategory &&
        findChannelByName(guild, channelDef.name, staffCategory.id)) ??
      channel;

    if (staffChannel && staffChannel.type === ChannelType.GuildText) {
      await (staffChannel as TextChannel).permissionOverwrites.set(overwrites);
      await sleep(200);
    }
  }

  // Ensure bot can always see staff channels
  const me = guild.members.me;
  if (me && staffCategory) {
    await staffCategory.permissionOverwrites.edit(me.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      EmbedLinks: true,
      ManageChannels: true,
      ManageMessages: true,
    });

    for (const channelDef of CATEGORIES.find((c) => c.name === '🔒 STAFF')?.channels ?? []) {
      const ch = findChannelByName(guild, channelDef.name, staffCategory.id);
      if (ch && ch.type === ChannelType.GuildText) {
        await (ch as TextChannel).permissionOverwrites.edit(me.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          EmbedLinks: true,
          ManageChannels: true,
          ManageMessages: true,
        });
      }
    }
  }
}

async function sendInformationEmbeds(guild: Guild): Promise<void> {
  const config = getGuildConfig(guild.id);

  const targets: Array<{
    channelName: string;
    entityId: ManagedEmbedKey;
    storedMessageId: string | null;
    messageIdField:
      | 'welcomeMessageId'
      | 'rulesMessageId'
      | 'servicesMessageId'
      | 'pricingMessageId'
      | 'ticketPanelMessageId';
    embeds: () => ReturnType<typeof createWelcomeEmbed>[];
    components?: () => ReturnType<typeof createTicketPanelButtons>;
  }> = [
    {
      channelName: '👋・welcome',
      entityId: 'welcome',
      storedMessageId: config.welcomeMessageId,
      messageIdField: 'welcomeMessageId',
      embeds: () => [createWelcomeEmbed()],
    },
    {
      channelName: '📜・rules',
      entityId: 'rules',
      storedMessageId: config.rulesMessageId,
      messageIdField: 'rulesMessageId',
      embeds: () => [createRulesEmbed()],
    },
    {
      channelName: '💼・services',
      entityId: 'services',
      storedMessageId: config.servicesMessageId,
      messageIdField: 'servicesMessageId',
      embeds: () => [createServicesEmbed()],
    },
    {
      channelName: '💰・pricing',
      entityId: 'pricing',
      storedMessageId: config.pricingMessageId,
      messageIdField: 'pricingMessageId',
      embeds: () => [createPricingEmbed()],
    },
    {
      channelName: '🎫・create-ticket',
      entityId: 'ticket',
      storedMessageId: config.ticketPanelMessageId,
      messageIdField: 'ticketPanelMessageId',
      embeds: () => [createTicketPanelEmbed()],
      components: () => createTicketPanelButtons(),
    },
  ];

  for (const target of targets) {
    const channel = findTextChannelByName(guild, target.channelName);
    if (!channel) continue;

    const { message } = await publishManagedEmbed({
      guildId: guild.id,
      channel,
      entityId: target.entityId,
      embeds: target.embeds(),
      components: target.components?.() ?? [],
      storedMessageId: target.storedMessageId,
      legacyMarker: MANAGED_EMBED_MARKERS[target.entityId],
    });

    updateGuildConfig(guild.id, { [target.messageIdField]: message.id });
  }
}
