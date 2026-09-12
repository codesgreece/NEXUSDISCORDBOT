import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from './types';
import { openContentManager } from '../services/contentManagerService';

export const contentCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('content')
    .setDescription('NEXUS Content Manager (admin/staff)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await openContentManager(interaction);
  },
};
