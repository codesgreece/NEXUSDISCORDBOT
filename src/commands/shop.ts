import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types';
import { openShopMenu } from '../services/discordShopBrowseService';

export const shopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Άνοιξε το NEXUS Development Shop'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await openShopMenu(interaction);
  },
};
