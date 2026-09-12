import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from './types';
import { isStaffOrAdmin } from '../services/contentManagerService';
import { syncShopToDiscord } from '../services/discordShopSyncService';
import type { GuildMember } from 'discord.js';

export const syncShopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('sync-shop')
    .setDescription('Sync shop products into existing Discord channels (edit/create, no duplicates)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const member = interaction.member as GuildMember | null;
    if (!member || !isStaffOrAdmin(member)) {
      await interaction.reply({ content: '❌ Staff/admin only.', ephemeral: true });
      return;
    }
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const result = await syncShopToDiscord(interaction.guild);
    await interaction.editReply({
      content: [
        '🔄 **Shop sync complete**',
        `Categories touched: **${result.categories}**`,
        `Products synced: **${result.productsSynced}**`,
        `Failed: **${result.productsFailed}**`,
        result.errors.length ? `\n${result.errors.slice(0, 15).join('\n')}` : '',
      ].join('\n'),
    });
  },
};
