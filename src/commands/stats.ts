import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from './types';
import { openControlCenter } from '../services/controlCenterService';

export const statsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Server / shop statistics (NEXUS Control Center)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await openControlCenter(interaction);
  },
};
