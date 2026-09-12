import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from './types';
import { openProductManager } from '../services/contentManagerService';

export const shopAdminCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('shop-admin')
    .setDescription('Product management shortcuts (admin/staff)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await openProductManager(interaction);
  },
};
