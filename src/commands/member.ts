import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from './types';
import { openControlCenter } from '../services/controlCenterService';

export const memberCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('member')
    .setDescription('Member Manager (NEXUS Control Center)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await openControlCenter(interaction);
  },
};
