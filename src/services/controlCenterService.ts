/**
 * NEXUS Control Center — interactive Discord management hub.
 * One panel message, edited in place. Configuration-driven, guild-scoped.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Guild,
  GuildMember,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { BRAND } from '../config/serverStructure';
import { NEXUS_IDS } from '../config/contentMapping';
import { requireAdmin, requireStaff } from './permissionService';
import { openContentManager } from './contentManagerService';
import { openShopAdmin } from './contentManagerService';
import { syncShopToDiscord } from './discordShopSyncService';
import {
  DEFAULT_AUTOMOD,
  getAutomodSettings,
  getRoleBindings,
  getSecuritySettings,
  getWelcomeSettings,
  listBackups,
  listModerationCases,
  listProjects,
  listReviews,
  setAutomodSettings,
  setRoleBindings,
  setSecuritySettings,
  setWelcomeSettings,
  type AutomodSettings,
} from '../db/controlRepository';
import { getGuildConfig, updateGuildConfig } from '../db/guildConfigRepository';
import { listProducts } from '../db/shopProductRepository';
import { listOrdersForGuild } from '../db/shopOrderRepository';
import { logEvent } from './loggingService';
import * as channelService from './channelService';
import * as roleService from './roleService';
import * as memberService from './memberService';
import {
  banMember,
  nicknameMember,
  setMemberRoles,
  unbanMember,
  warnMember,
} from './moderationService';
import { createGuildBackup, restoreGuildBackup } from './backupService';
import { buildStatsEmbed } from './statsService';
import { runFullSync } from './syncService';

type CtrlInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | StringSelectMenuInteraction
  | ModalSubmitInteraction;

type PanelComponents = ActionRowBuilder<MessageActionRowComponentBuilder>[];

const SECTIONS = [
  { value: 'server', label: 'Server', emoji: '🛡️' },
  { value: 'content', label: 'Content', emoji: '📢' },
  { value: 'shop', label: 'Shop', emoji: '🛒' },
  { value: 'tickets', label: 'Tickets', emoji: '🎫' },
  { value: 'members', label: 'Members', emoji: '👥' },
  { value: 'roles', label: 'Roles', emoji: '🎭' },
  { value: 'channels', label: 'Channels', emoji: '📁' },
  { value: 'moderation', label: 'Moderation', emoji: '🔨' },
  { value: 'automod', label: 'AutoMod', emoji: '🤖' },
  { value: 'welcome', label: 'Welcome', emoji: '👋' },
  { value: 'reviews', label: 'Reviews', emoji: '⭐' },
  { value: 'projects', label: 'Projects', emoji: '🚀' },
  { value: 'stats', label: 'Statistics', emoji: '📊' },
  { value: 'logs', label: 'Logs', emoji: '📋' },
  { value: 'backups', label: 'Backups', emoji: '💾' },
  { value: 'security', label: 'Security', emoji: '🔐' },
  { value: 'settings', label: 'Settings', emoji: '⚙️' },
  { value: 'sync', label: 'Sync', emoji: '🔄' },
] as const;

type Section = (typeof SECTIONS)[number]['value'];

function rootEmbed(guild: Guild): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('NEXUS CONTROL CENTER')
    .setDescription(
      [
        '```',
        '╔══════════════════════════════════╗',
        '       NEXUS CONTROL CENTER',
        '╚══════════════════════════════════╝',
        '```',
        `Διαχείριση **${guild.name}** απευθείας από το Discord.`,
        '',
        'Επίλεξε ενότητα από το μενού. Όλες οι αλλαγές αποθηκεύονται στη βάση (ανά guild).',
      ].join('\n'),
    )
    .setFooter({ text: BRAND.name })
    .setTimestamp();
}

function navRow(current?: string): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(NEXUS_IDS.CTRL_NAV)
      .setPlaceholder('📂 Επίλεξε ενότητα…')
      .addOptions(
        SECTIONS.map((s) => ({
          label: s.label,
          value: s.value,
          emoji: s.emoji,
          default: current === s.value,
          description: `Άνοιγμα: ${s.label}`.slice(0, 100),
        })),
      ),
  );
}

function backRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${NEXUS_IDS.CTRL_ACTION}:home`)
      .setLabel('Control Home')
      .setEmoji('🏠')
      .setStyle(ButtonStyle.Secondary),
  );
}

function actionId(action: string, ...parts: string[]): string {
  return [`${NEXUS_IDS.CTRL_ACTION}:${action}`, ...parts].join(':');
}

async function renderHome(interaction: CtrlInteraction): Promise<void> {
  const guild = interaction.guild!;
  const payload = {
    embeds: [rootEmbed(guild)],
    components: [navRow()],
  };
  if (interaction.isChatInputCommand()) {
    await interaction.reply({ ...payload, ephemeral: true });
    return;
  }
  if (interaction.isModalSubmit()) {
    if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
    else await interaction.reply({ ...payload, ephemeral: true });
    return;
  }
  await interaction.update(payload);
}

export async function openControlCenter(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!requireStaff(member)) {
    const msg = { content: '❌ Μόνο administrators / staff.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
    else await interaction.reply(msg);
    return;
  }
  if (interaction.isButton()) {
    await interaction.update({ embeds: [rootEmbed(interaction.guild!)], components: [navRow()] });
    return;
  }
  await interaction.reply({
    embeds: [rootEmbed(interaction.guild!)],
    components: [navRow()],
    ephemeral: true,
  });
}

async function renderSection(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  section: Section,
): Promise<void> {
  const guild = interaction.guild!;
  const member = interaction.member as GuildMember;

  let embed: EmbedBuilder;
  let components: ActionRowBuilder[] = [];

  switch (section) {
    case 'server':
      ({ embed, components } = buildServerPanel(guild));
      break;
    case 'content':
      embed = new EmbedBuilder()
        .setColor(BRAND.accent)
        .setTitle('📢 Content Manager')
        .setDescription(
          'Διαχείριση announcements, pages, products, reviews, projects.\nΆνοιξε το πλήρες Content Manager.',
        );
      components = [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(actionId('open_content'))
            .setLabel('Open Content Manager')
            .setEmoji('📢')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(actionId('sync_content'))
            .setLabel('Sync Content')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary),
        ),
      ];
      break;
    case 'shop':
      ({ embed, components } = buildShopPanel(guild));
      break;
    case 'tickets':
      ({ embed, components } = buildTicketsPanel(guild));
      break;
    case 'members':
      ({ embed, components } = buildMembersPanel());
      break;
    case 'roles':
      ({ embed, components } = buildRolesPanel(guild));
      break;
    case 'channels':
      ({ embed, components } = buildChannelsPanel(guild));
      break;
    case 'moderation':
      ({ embed, components } = buildModerationPanel(guild));
      break;
    case 'automod':
      ({ embed, components } = buildAutomodPanel(guild));
      break;
    case 'welcome':
      ({ embed, components } = buildWelcomePanel(guild));
      break;
    case 'reviews':
      ({ embed, components } = buildReviewsPanel(guild));
      break;
    case 'projects':
      ({ embed, components } = buildProjectsPanel(guild));
      break;
    case 'stats':
      embed = buildStatsEmbed(guild);
      components = [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(actionId('stats_refresh'))
            .setLabel('Refresh')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Primary),
        ),
      ];
      break;
    case 'logs':
      ({ embed, components } = buildLogsPanel(guild));
      break;
    case 'backups':
      ({ embed, components } = buildBackupsPanel(guild));
      break;
    case 'security':
      ({ embed, components } = buildSecurityPanel(guild, member));
      break;
    case 'settings':
      ({ embed, components } = buildSettingsPanel(guild));
      break;
    case 'sync':
      ({ embed, components } = buildSyncPanel());
      break;
    default:
      embed = rootEmbed(guild);
      components = [];
  }

  const rows = [...components, navRow(section), backRow()].slice(0, 5) as PanelComponents;
  const payload = { embeds: [embed], components: rows };

  if (interaction.isModalSubmit()) {
    if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
    else await interaction.reply({ ...payload, ephemeral: true });
    return;
  }
  await interaction.update(payload);
}

function buildServerPanel(guild: Guild): {
  embed: EmbedBuilder;
  components: PanelComponents;
} {
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('🛡️ Server Management')
    .setDescription(
      [
        `**Name:** ${guild.name}`,
        `**ID:** \`${guild.id}\``,
        `**Owner:** <@${guild.ownerId}>`,
        `**Members:** ${guild.memberCount}`,
        `**Channels:** ${guild.channels.cache.size}`,
        `**Roles:** ${guild.roles.cache.size}`,
        `**Verification:** ${guild.verificationLevel}`,
        `**AFK channel:** ${guild.afkChannelId ? `<#${guild.afkChannelId}>` : '—'}`,
        `**System channel:** ${guild.systemChannelId ? `<#${guild.systemChannelId}>` : '—'}`,
      ].join('\n'),
    )
    .setFooter({ text: 'Αλλαγές μέσω Discord API · απαιτεί Manage Guild' });

  const components = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(actionId('server_rename'))
        .setLabel('Rename Server')
        .setEmoji('✏️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(actionId('server_system'))
        .setLabel('System Channel')
        .setEmoji('📢')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(actionId('server_afk'))
        .setLabel('AFK Channel')
        .setEmoji('💤')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
  return { embed, components };
}

function buildShopPanel(guild: Guild): { embed: EmbedBuilder; components: ActionRowBuilder[] } {
  const products = listProducts({ activeOnly: true });
  const orders = listOrdersForGuild(guild.id, 5);
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('🛒 Shop Admin')
    .setDescription(
      [
        `Ενεργά προϊόντα: **${products.length}**`,
        `Πρόσφατες παραγγελίες: **${orders.length}**`,
        '',
        'Διαχείριση προϊόντων/κατηγοριών χωρίς αλλαγή κώδικα.',
      ].join('\n'),
    );
  const components = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(actionId('open_shop_admin'))
        .setLabel('Shop Admin')
        .setEmoji('🛒')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(actionId('sync_shop'))
        .setLabel('Sync Shop Panels')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary),
    ),
  ];
  return { embed, components };
}

function buildTicketsPanel(guild: Guild): { embed: EmbedBuilder; components: ActionRowBuilder[] } {
  const cfg = getGuildConfig(guild.id);
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('🎫 Ticket Settings')
    .setDescription(
      [
        `Enabled: **${cfg.ticketsEnabled ? 'Ναι' : 'Όχι'}**`,
        `Category: ${cfg.ticketCategoryId ? `<#${cfg.ticketCategoryId}>` : '—'}`,
        `Log channel: ${cfg.logChannelId ? `<#${cfg.logChannelId}>` : '—'}`,
        `Staff roles: ${cfg.staffRoleIds.length ? cfg.staffRoleIds.map((id) => `<@&${id}>`).join(', ') : '—'}`,
      ].join('\n'),
    );
  const components = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(actionId('tickets_toggle'))
        .setLabel(cfg.ticketsEnabled ? 'Disable Tickets' : 'Enable Tickets')
        .setStyle(cfg.ticketsEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(actionId('tickets_category'))
        .setLabel('Set Category')
        .setEmoji('📁')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(actionId('tickets_log'))
        .setLabel('Set Log Channel')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
  return { embed, components };
}

function buildMembersPanel(): { embed: EmbedBuilder; components: ActionRowBuilder[] } {
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('👥 Member Manager')
    .setDescription('Επίλεξε μέλος για προβολή / moderation / roles / nickname.');
  const components = [
    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(`${NEXUS_IDS.CTRL_USER}:member`)
        .setPlaceholder('Επίλεξε μέλος…')
        .setMinValues(1)
        .setMaxValues(1),
    ),
  ];
  return { embed, components };
}

function buildRolesPanel(guild: Guild): { embed: EmbedBuilder; components: ActionRowBuilder[] } {
  const roles = roleService.listRoles(guild.id).slice(0, 15);
  const bindings = getRoleBindings(guild.id);
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('🎭 Role Manager')
    .setDescription(
      [
        roles.map((r) => `• <@&${r.id}> — \`${r.name}\``).join('\n') || '_No roles_',
        '',
        '**Bindings**',
        `Admin: ${bindings.adminRoleId ? `<@&${bindings.adminRoleId}>` : '—'}`,
        `Staff: ${bindings.staffRoleId ? `<@&${bindings.staffRoleId}>` : '—'}`,
        `Moderator: ${bindings.moderatorRoleId ? `<@&${bindings.moderatorRoleId}>` : '—'}`,
        `Customer: ${bindings.customerRoleId ? `<@&${bindings.customerRoleId}>` : '—'}`,
        `Verified: ${bindings.verifiedRoleId ? `<@&${bindings.verifiedRoleId}>` : '—'}`,
        `Auto-role: ${bindings.autoRoleId ? `<@&${bindings.autoRoleId}>` : '—'}`,
      ].join('\n'),
    );
  const components = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(actionId('role_create'))
        .setLabel('Create Role')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(actionId('role_bind'))
        .setLabel('Bind Special Roles')
        .setEmoji('🔗')
        .setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`${NEXUS_IDS.CTRL_ROLE}:manage`)
        .setPlaceholder('Επίλεξε role για edit/delete…')
        .setMinValues(1)
        .setMaxValues(1),
    ),
  ];
  return { embed, components };
}

function buildChannelsPanel(guild: Guild): { embed: EmbedBuilder; components: ActionRowBuilder[] } {
  const listed = channelService.listChannels(guild.id);
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('📁 Channel Manager')
    .setDescription(
      [
        `Categories: **${listed.categories.length}** · Text: **${listed.text.length}** · Voice: **${listed.voice.length}**`,
        '',
        'Δημιουργία / rename / lock / slowmode / delete με επιβεβαίωση.\n🌐 Create Discord Servers Category = μόνο κατηγορία κάτω από 🤖 DISCORD BOTS (χωρίς channels).',
      ].join('\n'),
    );
  const components = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(actionId('channel_create_text'))
        .setLabel('Create Text')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(actionId('channel_create_voice'))
        .setLabel('Create Voice')
        .setEmoji('🔊')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(actionId('channel_create_cat'))
        .setLabel('Create Category')
        .setEmoji('📂')
        .setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(actionId('channel_create_discord_servers_cat'))
        .setLabel('Create Discord Servers Category')
        .setEmoji('🌐')
        .setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`${NEXUS_IDS.CTRL_CHANNEL}:manage`)
        .setPlaceholder('Επίλεξε channel…')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildVoice,
          ChannelType.GuildCategory,
          ChannelType.GuildForum,
        )
        .setMinValues(1)
        .setMaxValues(1),
    ),
  ];
  return { embed, components };
}

function buildModerationPanel(guild: Guild): { embed: EmbedBuilder; components: ActionRowBuilder[] } {
  const recent = listModerationCases(guild.id, undefined, 8);
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('🔨 Moderation')
    .setDescription(
      [
        'Warn · Timeout · Kick · Ban · Unban · Purge',
        '',
        '**Recent cases**',
        recent.length
          ? recent
              .map(
                (c) =>
                  `• \`${c.type}\` <@${c.userId}> — ${c.reason || '—'} (${new Date(c.createdAt).toLocaleDateString()})`,
              )
              .join('\n')
          : '_Καμία ακόμα_',
      ].join('\n'),
    );
  const components = [
    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(`${NEXUS_IDS.CTRL_USER}:mod`)
        .setPlaceholder('Επίλεξε χρήστη για moderation…')
        .setMinValues(1)
        .setMaxValues(1),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(actionId('purge_modal'))
        .setLabel('Purge Messages')
        .setEmoji('🧹')
        .setStyle(ButtonStyle.Danger),
    ),
  ];
  return { embed, components };
}

function buildAutomodPanel(guild: Guild): { embed: EmbedBuilder; components: ActionRowBuilder[] } {
  const cfg = getAutomodSettings(guild.id);
  const lines = (Object.entries(cfg) as Array<[keyof AutomodSettings, AutomodSettings[keyof AutomodSettings]]>)
    .map(([key, rule]) => {
      const enabled = 'enabled' in rule ? rule.enabled : false;
      return `${enabled ? '🟢' : '🔴'} **${key}**`;
    })
    .join('\n');
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('🤖 AutoMod')
    .setDescription(
      [
        'Κανόνες με thresholds/actions στη βάση (ανά guild).',
        '',
        lines,
        '',
        'Toggle κανόνα από το μενού.',
      ].join('\n'),
    );
  const components = [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${NEXUS_IDS.CTRL_SELECT}:automod_toggle`)
        .setPlaceholder('Toggle AutoMod rule…')
        .addOptions(
          (Object.keys(DEFAULT_AUTOMOD) as Array<keyof AutomodSettings>).slice(0, 25).map((key) => ({
            label: key,
            value: key,
            description: cfg[key].enabled ? 'Enabled — click to disable' : 'Disabled — click to enable',
          })),
        ),
    ),
  ];
  return { embed, components };
}

function buildWelcomePanel(guild: Guild): { embed: EmbedBuilder; components: ActionRowBuilder[] } {
  const w = getWelcomeSettings(guild.id);
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('👋 Welcome System')
    .setDescription(
      [
        `Enabled: **${w.enabled ? 'Ναι' : 'Όχι'}**`,
        `Channel: ${w.channelId ? `<#${w.channelId}>` : '—'}`,
        `Title: ${w.title}`,
        `Auto-role: ${w.autoRoleId ? `<@&${w.autoRoleId}>` : '—'}`,
        `DM: **${w.dmEnabled ? 'Ναι' : 'Όχι'}**`,
        `Leave msgs: **${w.leaveEnabled ? 'Ναι' : 'Όχι'}**`,
        '',
        'Variables: `{user}` `{username}` `{server}` `{memberCount}`',
      ].join('\n'),
    );
  const components = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(actionId('welcome_toggle'))
        .setLabel(w.enabled ? 'Disable' : 'Enable')
        .setStyle(w.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(actionId('welcome_edit'))
        .setLabel('Edit Message')
        .setEmoji('✏️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(actionId('welcome_channel'))
        .setLabel('Set Channel')
        .setEmoji('📢')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
  return { embed, components };
}

function buildReviewsPanel(guild: Guild): { embed: EmbedBuilder; components: ActionRowBuilder[] } {
  const reviews = listReviews(guild.id).slice(0, 10);
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('⭐ Reviews')
    .setDescription(
      reviews.length
        ? reviews
            .map(
              (r) =>
                `${r.approved ? '✅' : '⏳'} ${'⭐'.repeat(Number(r.rating))} <@${r.user_id}> — ${String(r.comment).slice(0, 80)}`,
            )
            .join('\n')
        : '_Καμία αξιολόγηση ακόμα_',
    );
  const components = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(actionId('reviews_approve_latest'))
        .setLabel('Approve Latest')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(actionId('reviews_refresh'))
        .setLabel('Refresh')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
  return { embed, components };
}

function buildProjectsPanel(guild: Guild): { embed: EmbedBuilder; components: ActionRowBuilder[] } {
  const projects = listProjects(guild.id).slice(0, 10);
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('🚀 Projects / Portfolio')
    .setDescription(
      projects.length
        ? projects
            .map((p) => `• **${p.name}** [\`${p.status}\`] — ${String(p.description).slice(0, 60)}`)
            .join('\n')
        : '_Κανένα project_',
    );
  const components = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(actionId('project_create'))
        .setLabel('New Project')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(actionId('projects_sync'))
        .setLabel('Publish to Channels')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary),
    ),
  ];
  return { embed, components };
}

function buildLogsPanel(guild: Guild): { embed: EmbedBuilder; components: ActionRowBuilder[] } {
  const cfg = getGuildConfig(guild.id);
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('📋 Logs')
    .setDescription(
      [
        `Log channel: ${cfg.logChannelId ? `<#${cfg.logChannelId}>` : '📝・logs (auto-detect)'}`,
        '',
        'Κατηγορίες: SERVER · MEMBER · MODERATION · ROLE · CHANNEL · TICKET · SHOP · ORDER · CONTENT · SECURITY · BOT',
        '',
        'Τα secrets (tokens, passwords) **δεν** καταγράφονται ποτέ.',
      ].join('\n'),
    );
  const components = [
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`${NEXUS_IDS.CTRL_CHANNEL}:logs`)
        .setPlaceholder('Όρισε log channel…')
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1),
    ),
  ];
  return { embed, components };
}

function buildBackupsPanel(guild: Guild): { embed: EmbedBuilder; components: ActionRowBuilder[] } {
  const backups = listBackups(guild.id);
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('💾 Backups')
    .setDescription(
      [
        'Αποθηκεύει categories, channels, roles, shop, content, settings στη βάση.',
        'Restore απαιτεί επιβεβαίωση.',
        '',
        backups.length
          ? backups
              .map((b) => `• \`${b.id.slice(0, 8)}\` **${b.label}** — ${new Date(b.created_at).toLocaleString()}`)
              .join('\n')
          : '_Κανένα backup_',
      ].join('\n'),
    );
  const components = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(actionId('backup_create'))
        .setLabel('Create Backup')
        .setEmoji('💾')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(actionId('backup_restore'))
        .setLabel('Restore Latest')
        .setEmoji('♻️')
        .setStyle(ButtonStyle.Danger),
    ),
  ];
  return { embed, components };
}

function buildSecurityPanel(
  guild: Guild,
  member: GuildMember,
): { embed: EmbedBuilder; components: ActionRowBuilder[] } {
  const sec = getSecuritySettings(guild.id);
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('🔐 Security Center')
    .setDescription(
      [
        `Confirm dangerous actions: **${sec.requireConfirmDangerous ? 'ON' : 'OFF'}**`,
        `Rate limit / min: **${sec.rateLimitPerMinute}**`,
        `Command cooldown: **${sec.commandCooldownSeconds}s**`,
        `Audit logging: **${sec.auditLogging ? 'ON' : 'OFF'}**`,
        '',
        `Your access: <@${member.id}>`,
      ].join('\n'),
    );
  const components = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(actionId('security_toggle_confirm'))
        .setLabel('Toggle Confirmations')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(actionId('security_toggle_audit'))
        .setLabel('Toggle Audit Log')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
  return { embed, components };
}

function buildSettingsPanel(guild: Guild): { embed: EmbedBuilder; components: ActionRowBuilder[] } {
  const cfg = getGuildConfig(guild.id);
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('⚙️ Guild Settings')
    .setDescription(
      [
        'Ρυθμίσεις ανά guild στη SQLite.',
        '',
        `Tickets: **${cfg.ticketsEnabled ? 'ON' : 'OFF'}**`,
        `Staff roles stored: **${cfg.staffRoleIds.length}**`,
        '',
        'Χρησιμοποίησε Role Select για staff roles.',
      ].join('\n'),
    );
  const components = [
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`${NEXUS_IDS.CTRL_ROLE}:staff`)
        .setPlaceholder('Όρισε staff roles…')
        .setMinValues(0)
        .setMaxValues(10),
    ),
  ];
  return { embed, components };
}

function buildSyncPanel(): { embed: EmbedBuilder; components: ActionRowBuilder[] } {
  const embed = new EmbedBuilder()
    .setColor(BRAND.accent)
    .setTitle('🔄 Sync')
    .setDescription(
      [
        'Συγχρονισμός managed Discord messages (edit αν υπάρχει, create αλλιώς).',
        '',
        '• Full Sync',
        '• Shop panels',
        '• Content pages',
        '• Welcome (config only)',
        '• Projects / Reviews publish',
      ].join('\n'),
    );
  const components = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(actionId('sync_full'))
        .setLabel('Full Sync')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(actionId('sync_shop'))
        .setLabel('Shop')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(actionId('sync_content'))
        .setLabel('Content')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
  return { embed, components };
}

/* ---------------- interaction handlers ---------------- */

export async function handleControlNav(interaction: StringSelectMenuInteraction): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!requireStaff(member)) {
    await interaction.reply({ content: '❌ Staff only.', ephemeral: true });
    return;
  }
  const section = interaction.values[0] as Section;
  await renderSection(interaction, section);
}

export async function handleControlButton(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!requireStaff(member)) {
    await interaction.reply({ content: '❌ Staff only.', ephemeral: true });
    return;
  }

  const id = interaction.customId;
  const parts = id.slice(`${NEXUS_IDS.CTRL_ACTION}:`.length).split(':');
  const action = parts[0];
  const guild = interaction.guild!;

  try {
    switch (action) {
      case 'home':
        await renderHome(interaction);
        return;
      case 'open_content':
        await openContentManager(interaction);
        return;
      case 'open_shop_admin':
        await openShopAdmin(interaction);
        return;
      case 'sync_shop': {
        await interaction.deferUpdate();
        const result = await syncShopToDiscord(guild);
        await interaction.followUp({
          content: `🔄 Shop sync: categories **${result.categories}**, products **${result.productsSynced}**, failed **${result.productsFailed}**`,
          ephemeral: true,
        });
        return;
      }
      case 'sync_full': {
        await interaction.deferUpdate();
        const result = await runFullSync(guild);
        await interaction.followUp({ content: result.summary, ephemeral: true });
        return;
      }
      case 'sync_content': {
        await interaction.deferUpdate();
        const result = await runFullSync(guild, { shop: false, content: true, projects: true });
        await interaction.followUp({ content: result.summary, ephemeral: true });
        return;
      }
      case 'tickets_toggle': {
        const cfg = getGuildConfig(guild.id);
        updateGuildConfig(guild.id, { ticketsEnabled: !cfg.ticketsEnabled });
        await renderSection(interaction, 'tickets');
        return;
      }
      case 'server_rename': {
        const modal = new ModalBuilder()
          .setCustomId(`${NEXUS_IDS.CTRL_MODAL}:server_rename`)
          .setTitle('Rename Server')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('name')
                .setLabel('New server name')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100)
                .setValue(guild.name.slice(0, 100)),
            ),
          );
        await interaction.showModal(modal);
        return;
      }
      case 'welcome_toggle': {
        const w = getWelcomeSettings(guild.id);
        setWelcomeSettings(guild.id, { enabled: !w.enabled });
        await renderSection(interaction, 'welcome');
        return;
      }
      case 'welcome_edit': {
        const w = getWelcomeSettings(guild.id);
        const modal = new ModalBuilder()
          .setCustomId(`${NEXUS_IDS.CTRL_MODAL}:welcome_edit`)
          .setTitle('Welcome Message')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('title')
                .setLabel('Embed title')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue(w.title.slice(0, 100)),
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Embed description')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setValue(w.description.slice(0, 1000)),
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('footer')
                .setLabel('Footer')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue(w.footer.slice(0, 100)),
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('color')
                .setLabel('Color hex (#5865F2)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue(w.color.slice(0, 16)),
            ),
          );
        await interaction.showModal(modal);
        return;
      }
      case 'role_create': {
        const modal = new ModalBuilder()
          .setCustomId(`${NEXUS_IDS.CTRL_MODAL}:role_create`)
          .setTitle('Create Role')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('name')
                .setLabel('Role name')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100),
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('color')
                .setLabel('Color hex (optional)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(16),
            ),
          );
        await interaction.showModal(modal);
        return;
      }
      case 'channel_create_discord_servers_cat': {
        await interaction.deferReply({ ephemeral: true });
        try {
          const result = await channelService.createDiscordServersCategory(guild.id, {
            id: interaction.user.id,
            tag: interaction.user.tag,
          });
          await interaction.editReply({ content: result.message });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          await interaction.editReply({
            content: `❌ Failed to create **🌐 DISCORD SERVERS**: ${msg}`,
          });
        }
        return;
      }
      case 'channel_create_text':
      case 'channel_create_voice':
      case 'channel_create_cat': {
        const type =
          action === 'channel_create_voice'
            ? 'voice'
            : action === 'channel_create_cat'
              ? 'category'
              : 'text';
        const modal = new ModalBuilder()
          .setCustomId(`${NEXUS_IDS.CTRL_MODAL}:channel_create:${type}`)
          .setTitle(`Create ${type} channel`)
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('name')
                .setLabel('Channel name')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100),
            ),
          );
        await interaction.showModal(modal);
        return;
      }
      case 'purge_modal': {
        const modal = new ModalBuilder()
          .setCustomId(`${NEXUS_IDS.CTRL_MODAL}:purge`)
          .setTitle('Purge Messages')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('amount')
                .setLabel('Amount (1-100)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue('10'),
            ),
          );
        await interaction.showModal(modal);
        return;
      }
      case 'project_create': {
        const modal = new ModalBuilder()
          .setCustomId(`${NEXUS_IDS.CTRL_MODAL}:project_create`)
          .setTitle('New Project')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('name')
                .setLabel('Project name')
                .setStyle(TextInputStyle.Short)
                .setRequired(true),
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Description')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true),
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('category')
                .setLabel('Category (PROJECTS / PORTFOLIO / BOT_PROJECTS)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue('PROJECTS'),
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('url')
                .setLabel('URL (optional)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false),
            ),
          );
        await interaction.showModal(modal);
        return;
      }
      case 'backup_create': {
        await interaction.deferUpdate();
        const id = await createGuildBackup(guild, `Manual by ${interaction.user.tag}`);
        await interaction.followUp({
          content: `💾 Backup δημιουργήθηκε: \`${id}\``,
          ephemeral: true,
        });
        return;
      }
      case 'backup_restore': {
        const backups = listBackups(guild.id);
        if (!backups.length) {
          await interaction.reply({ content: 'Δεν υπάρχει backup.', ephemeral: true });
          return;
        }
        await interaction.update({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.danger)
              .setTitle('⚠️ Confirm Restore')
              .setDescription(
                `Θα γίνει restore το backup **${backups[0].label}** (\`${backups[0].id.slice(0, 8)}\`).\nΑυτό μπορεί να αλλάξει ρυθμίσεις. Continuάς;`,
              ),
          ],
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`${NEXUS_IDS.CTRL_CONFIRM}:backup:${backups[0].id}`)
                .setLabel('Confirm Restore')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId(actionId('home'))
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary),
            ),
          ],
        });
        return;
      }
      case 'security_toggle_confirm': {
        const sec = getSecuritySettings(guild.id);
        setSecuritySettings(guild.id, { requireConfirmDangerous: !sec.requireConfirmDangerous });
        await renderSection(interaction, 'security');
        return;
      }
      case 'security_toggle_audit': {
        const sec = getSecuritySettings(guild.id);
        setSecuritySettings(guild.id, { auditLogging: !sec.auditLogging });
        await renderSection(interaction, 'security');
        return;
      }
      case 'stats_refresh':
      case 'reviews_refresh':
        await renderSection(
          interaction,
          action.startsWith('stats') ? 'stats' : 'reviews',
        );
        return;
      case 'reviews_approve_latest': {
        const pending = listReviews(guild.id).find((r) => !r.approved);
        if (!pending) {
          await interaction.reply({ content: 'Δεν υπάρχει pending review.', ephemeral: true });
          return;
        }
        const { setReviewApproved } = await import('../db/controlRepository');
        setReviewApproved(String(pending.id), true);
        await renderSection(interaction, 'reviews');
        return;
      }
      default:
        await interaction.reply({
          content: `Η ενέργεια \`${action}\` είναι διαθέσιμη από το αντίστοιχο submenu/select.`,
          ephemeral: true,
        });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: `❌ ${message}`, ephemeral: true }).catch(() => undefined);
    } else {
      await interaction.reply({ content: `❌ ${message}`, ephemeral: true }).catch(() => undefined);
    }
  }
}

export async function handleControlConfirm(interaction: ButtonInteraction): Promise<void> {
  if (!requireAdmin(interaction.member as GuildMember)) {
    await interaction.reply({ content: '❌ Admin only.', ephemeral: true });
    return;
  }
  const rest = interaction.customId.slice(`${NEXUS_IDS.CTRL_CONFIRM}:`.length);
  const [kind, id] = rest.split(':');
  if (kind === 'backup' && id) {
    await interaction.deferUpdate();
    const result = await restoreGuildBackup(interaction.guild!, id);
    await interaction.followUp({ content: result, ephemeral: true });
    return;
  }
  await interaction.reply({ content: 'Άγνωστη επιβεβαίωση.', ephemeral: true });
}

export async function handleControlModal(interaction: ModalSubmitInteraction): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!requireStaff(member)) {
    await interaction.reply({ content: '❌ Staff only.', ephemeral: true });
    return;
  }
  const guild = interaction.guild!;
  const id = interaction.customId.slice(`${NEXUS_IDS.CTRL_MODAL}:`.length);
  const [action, ...rest] = id.split(':');

  try {
    if (action === 'server_rename') {
      if (!member?.permissions.has(PermissionFlagsBits.ManageGuild) && !requireAdmin(member)) {
        await interaction.reply({ content: '❌ Χρειάζεσαι Manage Server.', ephemeral: true });
        return;
      }
      const name = interaction.fields.getTextInputValue('name').trim();
      await guild.setName(name);
      await logEvent(guild, {
        title: 'SERVER · Rename',
        description: `Το όνομα άλλαξε σε **${name}** από ${interaction.user.tag}`,
        actorId: interaction.user.id,
        actorTag: interaction.user.tag,
      });
      await interaction.reply({ content: `✅ Server name → **${name}**`, ephemeral: true });
      return;
    }

    if (action === 'welcome_edit') {
      setWelcomeSettings(guild.id, {
        title: interaction.fields.getTextInputValue('title').trim(),
        description: interaction.fields.getTextInputValue('description').trim(),
        footer: interaction.fields.getTextInputValue('footer').trim() || BRAND.name,
        color: interaction.fields.getTextInputValue('color').trim() || '#5865F2',
      });
      await interaction.reply({ content: '✅ Welcome message αποθηκεύτηκε.', ephemeral: true });
      return;
    }

    if (action === 'role_create') {
      const name = interaction.fields.getTextInputValue('name').trim();
      const color = interaction.fields.getTextInputValue('color').trim() || undefined;
      const role = await roleService.createRole(
        guild.id,
        { name, color },
        { id: interaction.user.id, tag: interaction.user.tag },
      );
      await interaction.reply({ content: `✅ Role <@&${role.id}> δημιουργήθηκε.`, ephemeral: true });
      return;
    }

    if (action === 'channel_create') {
      const type = (rest[0] || 'text') as 'text' | 'voice' | 'category';
      const name = interaction.fields.getTextInputValue('name').trim();
      const ch = await channelService.createChannel(
        guild.id,
        { name, type },
        { id: interaction.user.id, tag: interaction.user.tag },
      );
      await interaction.reply({
        content: `✅ ${type} channel **${ch.name}** δημιουργήθηκε.`,
        ephemeral: true,
      });
      return;
    }

    if (action === 'purge') {
      const amount = Math.min(100, Math.max(1, Number(interaction.fields.getTextInputValue('amount')) || 10));
      if (!interaction.channel || !interaction.channel.isTextBased() || interaction.channel.isDMBased()) {
        await interaction.reply({ content: '❌ Purge μόνο σε server text channels.', ephemeral: true });
        return;
      }
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await logEvent(guild, {
        title: 'MODERATION · Purge',
        description: `${interaction.user.tag} διέγραψε **${deleted.size}** μηνύματα σε <#${interaction.channel.id}>`,
        actorId: interaction.user.id,
        actorTag: interaction.user.tag,
        color: BRAND.warning,
      });
      await interaction.reply({ content: `🧹 Διεγράφησαν **${deleted.size}** μηνύματα.`, ephemeral: true });
      return;
    }

    if (action === 'project_create') {
      const { createProject } = await import('../db/controlRepository');
      const projectId = createProject({
        guildId: guild.id,
        name: interaction.fields.getTextInputValue('name').trim(),
        description: interaction.fields.getTextInputValue('description').trim(),
        category: interaction.fields.getTextInputValue('category').trim() || 'PROJECTS',
        url: interaction.fields.getTextInputValue('url').trim() || null,
      });
      await interaction.reply({ content: `✅ Project \`${projectId.slice(0, 8)}\` δημιουργήθηκε.`, ephemeral: true });
      return;
    }

    if (action === 'mod_action') {
      // customId: ctrl:modal:mod_action:{type}:{userId}
      const type = rest[0];
      const userId = rest[1];
      const reason = interaction.fields.getTextInputValue('reason').trim() || '—';
      const durationRaw = interaction.fields.getTextInputValue('duration')?.trim();
      const minutes = durationRaw ? Number(durationRaw) : 10;

      if (type === 'warn') await warnMember(guild, userId, interaction.user.id, reason);
      else if (type === 'timeout') await memberService.timeoutMember(guild.id, userId, minutes, { id: interaction.user.id, tag: interaction.user.tag });
      else if (type === 'kick') await memberService.kickMember(guild.id, userId, { id: interaction.user.id, tag: interaction.user.tag });
      else if (type === 'ban') await banMember(guild, userId, interaction.user.id, reason);
      else if (type === 'unban') await unbanMember(guild, userId, interaction.user.id, reason);
      else if (type === 'nick') {
        const nick = interaction.fields.getTextInputValue('reason').trim();
        await nicknameMember(guild, userId, nick || null, interaction.user.id);
      }

      await interaction.reply({
        content: `✅ Moderation **${type}** εφαρμόστηκε σε <@${userId}>.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({ content: '❌ Άγνωστο modal.', ephemeral: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await interaction.reply({ content: `❌ ${message}`, ephemeral: true }).catch(() => undefined);
  }
}

export async function handleControlSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!requireStaff(member)) {
    await interaction.reply({ content: '❌ Staff only.', ephemeral: true });
    return;
  }
  const id = interaction.customId;
  if (id === `${NEXUS_IDS.CTRL_SELECT}:automod_toggle`) {
    const key = interaction.values[0] as keyof AutomodSettings;
    const cfg = getAutomodSettings(interaction.guild!.id);
    const rule = cfg[key];
    if (rule && typeof rule === 'object' && 'enabled' in rule) {
      rule.enabled = !rule.enabled;
      setAutomodSettings(interaction.guild!.id, cfg);
    }
    await renderSection(interaction, 'automod');
    return;
  }

  // Moderation action picker after user select stores pending in customId of a follow-up select
  if (id.startsWith(`${NEXUS_IDS.CTRL_SELECT}:mod:`)) {
    const userId = id.slice(`${NEXUS_IDS.CTRL_SELECT}:mod:`.length);
    const type = interaction.values[0];
    const modal = new ModalBuilder()
      .setCustomId(`${NEXUS_IDS.CTRL_MODAL}:mod_action:${type}:${userId}`)
      .setTitle(`Moderation: ${type}`)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel(type === 'nick' ? 'New nickname' : 'Reason')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(type !== 'nick')
            .setMaxLength(500),
        ),
      );
    if (type === 'timeout') {
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('duration')
            .setLabel('Duration minutes')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue('10'),
        ),
      );
    }
    await interaction.showModal(modal);
    return;
  }

  await interaction.reply({ content: 'OK', ephemeral: true });
}

export async function handleControlUserSelect(interaction: import('discord.js').UserSelectMenuInteraction): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!requireStaff(member)) {
    await interaction.reply({ content: '❌ Staff only.', ephemeral: true });
    return;
  }
  const mode = interaction.customId.slice(`${NEXUS_IDS.CTRL_USER}:`.length);
  const user = interaction.users.first();
  if (!user) {
    await interaction.reply({ content: 'Δεν επιλέχθηκε χρήστης.', ephemeral: true });
    return;
  }
  const guild = interaction.guild!;
  const target = await guild.members.fetch(user.id).catch(() => null);
  const cases = listModerationCases(guild.id, user.id, 10);

  if (mode === 'member') {
    const embed = new EmbedBuilder()
      .setColor(BRAND.accent)
      .setTitle(`👤 ${user.tag}`)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(
        [
          `ID: \`${user.id}\``,
          `Joined: ${target?.joinedAt ? target.joinedAt.toLocaleString() : '—'}`,
          `Roles: ${target ? target.roles.cache.filter((r) => r.id !== guild.id).map((r) => `<@&${r.id}>`).join(', ') || '—' : '—'}`,
          '',
          '**Moderation history**',
          cases.length
            ? cases.map((c) => `• ${c.type} — ${c.reason || '—'}`).join('\n')
            : '_Καθαρό_',
        ].join('\n'),
      );
    await interaction.update({
      embeds: [embed],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`${NEXUS_IDS.CTRL_SELECT}:mod:${user.id}`)
            .setPlaceholder('Moderation action…')
            .addOptions(
              { label: 'Warn', value: 'warn', emoji: '⚠️' },
              { label: 'Timeout', value: 'timeout', emoji: '⏱️' },
              { label: 'Kick', value: 'kick', emoji: '👢' },
              { label: 'Ban', value: 'ban', emoji: '🔨' },
              { label: 'Unban', value: 'unban', emoji: '♻️' },
              { label: 'Change Nickname', value: 'nick', emoji: '✏️' },
            ),
        ),
        new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
          new RoleSelectMenuBuilder()
            .setCustomId(`${NEXUS_IDS.CTRL_ROLE}:assign:${user.id}`)
            .setPlaceholder('Πρόσθεσε roles…')
            .setMinValues(0)
            .setMaxValues(10),
        ),
        navRow('members'),
        backRow(),
      ],
    });
    return;
  }

  if (mode === 'mod') {
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.accent)
          .setTitle(`🔨 Moderation → ${user.tag}`)
          .setDescription('Επίλεξε ενέργεια:'),
      ],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`${NEXUS_IDS.CTRL_SELECT}:mod:${user.id}`)
            .setPlaceholder('Επίλεξε ενέργεια…')
            .addOptions(
              { label: 'Warn', value: 'warn', emoji: '⚠️' },
              { label: 'Timeout', value: 'timeout', emoji: '⏱️' },
              { label: 'Kick', value: 'kick', emoji: '👢' },
              { label: 'Ban', value: 'ban', emoji: '🔨' },
              { label: 'Unban', value: 'unban', emoji: '♻️' },
            ),
        ),
        navRow('moderation'),
        backRow(),
      ],
    });
  }
}

export async function handleControlRoleSelect(interaction: import('discord.js').RoleSelectMenuInteraction): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!requireStaff(member)) {
    await interaction.reply({ content: '❌ Staff only.', ephemeral: true });
    return;
  }
  const rest = interaction.customId.slice(`${NEXUS_IDS.CTRL_ROLE}:`.length);
  const [mode, userId] = rest.split(':');
  const guild = interaction.guild!;

  if (mode === 'staff') {
    const ids = interaction.roles.map((r) => r.id);
    updateGuildConfig(guild.id, { staffRoleIds: ids });
    await interaction.reply({
      content: `✅ Staff roles: ${ids.map((id) => `<@&${id}>`).join(', ') || '—'}`,
      ephemeral: true,
    });
    return;
  }

  if (mode === 'assign' && userId) {
    await setMemberRoles(
      guild,
      userId,
      interaction.roles.map((r) => r.id),
      interaction.user.id,
    );
    await interaction.reply({
      content: `✅ Roles ενημερώθηκαν για <@${userId}>.`,
      ephemeral: true,
    });
    return;
  }

  if (mode === 'manage') {
    const role = interaction.roles.first();
    if (!role) {
      await interaction.reply({ content: 'Δεν επιλέχθηκε role.', ephemeral: true });
      return;
    }
    const fullRole = await guild.roles.fetch(role.id).catch(() => null);
    if (!fullRole) {
      await interaction.reply({ content: 'Το role δεν βρέθηκε.', ephemeral: true });
      return;
    }
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.accent)
          .setTitle(`🎭 ${fullRole.name}`)
          .setDescription(
            [
              `ID: \`${fullRole.id}\``,
              `Color: ${fullRole.hexColor}`,
              `Members: ${fullRole.members.size}`,
              `Position: ${fullRole.position}`,
            ].join('\n'),
          ),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`${NEXUS_IDS.CTRL_CONFIRM}:role_delete:${fullRole.id}`)
            .setLabel('Delete Role')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(actionId('role_bind_pick', fullRole.id))
            .setLabel('Use as Staff Binding')
            .setStyle(ButtonStyle.Primary),
        ),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`${NEXUS_IDS.CTRL_SELECT}:bind:${fullRole.id}`)
            .setPlaceholder('Bind as special role…')
            .addOptions(
              { label: 'Admin role', value: 'adminRoleId' },
              { label: 'Staff role', value: 'staffRoleId' },
              { label: 'Moderator role', value: 'moderatorRoleId' },
              { label: 'Customer role', value: 'customerRoleId' },
              { label: 'Verified role', value: 'verifiedRoleId' },
              { label: 'Auto role', value: 'autoRoleId' },
              { label: 'Bot role', value: 'botRoleId' },
            ),
        ),
        navRow('roles'),
        backRow(),
      ],
    });
    return;
  }

  await interaction.reply({ content: 'OK', ephemeral: true });
}

export async function handleControlChannelSelect(
  interaction: import('discord.js').ChannelSelectMenuInteraction,
): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!requireStaff(member)) {
    await interaction.reply({ content: '❌ Staff only.', ephemeral: true });
    return;
  }
  const mode = interaction.customId.slice(`${NEXUS_IDS.CTRL_CHANNEL}:`.length);
  const channel = interaction.channels.first();
  if (!channel) {
    await interaction.reply({ content: 'Δεν επιλέχθηκε channel.', ephemeral: true });
    return;
  }
  const guild = interaction.guild!;

  if (mode === 'logs') {
    updateGuildConfig(guild.id, { logChannelId: channel.id });
    await interaction.reply({ content: `✅ Log channel → <#${channel.id}>`, ephemeral: true });
    return;
  }

  if (mode === 'manage') {
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.accent)
          .setTitle(`📁 #${'name' in channel ? channel.name : channel.id}`)
          .setDescription(`ID: \`${channel.id}\`\nType: ${channel.type}`),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(actionId('channel_lock', channel.id))
            .setLabel('Lock')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(actionId('channel_unlock', channel.id))
            .setLabel('Unlock')
            .setEmoji('🔓')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(actionId('channel_slow', channel.id))
            .setLabel('Slowmode 10s')
            .setEmoji('🐌')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`${NEXUS_IDS.CTRL_CONFIRM}:channel_delete:${channel.id}`)
            .setLabel('Delete')
            .setStyle(ButtonStyle.Danger),
        ),
        navRow('channels'),
        backRow(),
      ],
    });
    return;
  }

  if (mode.startsWith('welcome') || interaction.customId.includes('welcome')) {
    setWelcomeSettings(guild.id, { channelId: channel.id });
    await interaction.reply({ content: `✅ Welcome channel → <#${channel.id}>`, ephemeral: true });
  }
}

/** Extra button actions that need channel id in customId */
export async function handleControlChannelAction(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!requireStaff(member)) {
    await interaction.reply({ content: '❌ Staff only.', ephemeral: true });
    return;
  }
  const raw = interaction.customId.slice(`${NEXUS_IDS.CTRL_ACTION}:`.length);
  const [action, channelId] = raw.split(':');
  const guild = interaction.guild!;
  const ch = channelId ? await guild.channels.fetch(channelId).catch(() => null) : null;

  if (action === 'channel_lock' && ch && ch.isTextBased() && 'permissionOverwrites' in ch) {
    await ch.permissionOverwrites.edit(guild.id, { SendMessages: false });
    await interaction.reply({ content: `🔒 Locked <#${ch.id}>`, ephemeral: true });
    return;
  }
  if (action === 'channel_unlock' && ch && ch.isTextBased() && 'permissionOverwrites' in ch) {
    await ch.permissionOverwrites.edit(guild.id, { SendMessages: null });
    await interaction.reply({ content: `🔓 Unlocked <#${ch.id}>`, ephemeral: true });
    return;
  }
  if (action === 'channel_slow' && ch && ch.type === ChannelType.GuildText) {
    await ch.setRateLimitPerUser(10);
    await interaction.reply({ content: `🐌 Slowmode 10s σε <#${ch.id}>`, ephemeral: true });
    return;
  }
  if (action === 'welcome_channel') {
    await interaction.reply({
      content: 'Χρησιμοποίησε το Channel select στο Welcome panel / Logs για ορισμό καναλιού.',
      ephemeral: true,
      components: [
        new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId(`${NEXUS_IDS.CTRL_CHANNEL}:welcome`)
            .setPlaceholder('Welcome channel…')
            .addChannelTypes(ChannelType.GuildText),
        ),
      ],
    });
    return;
  }
  if (action === 'tickets_category') {
    await interaction.reply({
      content: 'Επίλεξε category για tickets:',
      ephemeral: true,
      components: [
        new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId(`${NEXUS_IDS.CTRL_CHANNEL}:ticket_category`)
            .setPlaceholder('Ticket category…')
            .addChannelTypes(ChannelType.GuildCategory),
        ),
      ],
    });
    return;
  }
  if (action === 'tickets_log') {
    await interaction.reply({
      content: 'Επίλεξε log channel:',
      ephemeral: true,
      components: [
        new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId(`${NEXUS_IDS.CTRL_CHANNEL}:logs`)
            .setPlaceholder('Log channel…')
            .addChannelTypes(ChannelType.GuildText),
        ),
      ],
    });
    return;
  }

  // Fall through to generic button handler
  await handleControlButton(interaction);
}

export async function handleControlBindSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  if (interaction.customId.startsWith(`${NEXUS_IDS.CTRL_SELECT}:bind:`)) {
    const roleId = interaction.customId.slice(`${NEXUS_IDS.CTRL_SELECT}:bind:`.length);
    const key = interaction.values[0] as keyof ReturnType<typeof getRoleBindings>;
    setRoleBindings(interaction.guild!.id, { [key]: roleId });
    await interaction.reply({
      content: `✅ Bound <@&${roleId}> → **${key}**`,
      ephemeral: true,
    });
    return;
  }
  await handleControlSelect(interaction);
}
