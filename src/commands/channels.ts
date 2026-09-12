import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from './types';
import { openControlCenter } from '../services/controlCenterService';

/** Opens Control Center focused on channels via the hub nav */
export const channelsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('channels')
    .setDescription('Channel Manager (NEXUS Control Center)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await openControlCenter(interaction);
  },
};
