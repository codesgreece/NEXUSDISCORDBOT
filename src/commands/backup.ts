import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from './types';
import { openControlCenter } from '../services/controlCenterService';

export const backupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Backup / restore guild configuration')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await openControlCenter(interaction);
  },
};
