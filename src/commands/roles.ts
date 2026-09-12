import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from './types';
import { openControlCenter } from '../services/controlCenterService';

export const rolesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Role Manager (NEXUS Control Center)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await openControlCenter(interaction);
  },
};
