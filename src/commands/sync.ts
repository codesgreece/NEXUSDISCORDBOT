import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from './types';
import { requireStaff } from '../services/permissionService';
import { runFullSync } from '../services/syncService';

export const syncCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('sync')
    .setDescription('Sync managed Discord messages (shop / content / projects)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt
        .setName('scope')
        .setDescription('What to sync')
        .addChoices(
          { name: 'Full', value: 'full' },
          { name: 'Shop', value: 'shop' },
          { name: 'Content', value: 'content' },
          { name: 'Projects', value: 'projects' },
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const member = interaction.member as GuildMember | null;
    if (!requireStaff(member)) {
      await interaction.reply({ content: '❌ Staff/admin only.', ephemeral: true });
      return;
    }
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const scope = interaction.options.getString('scope') || 'full';
    const result = await runFullSync(interaction.guild, {
      shop: scope === 'full' || scope === 'shop',
      content: scope === 'full' || scope === 'content',
      projects: scope === 'full' || scope === 'projects',
    });
    await interaction.editReply({ content: result.summary });
  },
};
