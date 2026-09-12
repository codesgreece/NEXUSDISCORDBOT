import { Interaction } from 'discord.js';
import { isTicketButton, routeTicketButton } from '../services/ticketService';
import { logError } from '../services/loggingService';

export async function interactionCreateHandler(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        await interaction.reply({
          content: '❌ Unknown command.',
          ephemeral: true,
        }).catch(() => undefined);
        return;
      }

      await command.execute(interaction);
      return;
    }

    if (interaction.isButton() && isTicketButton(interaction.customId)) {
      await routeTicketButton(interaction);
    }
  } catch (error) {
    await logError(interaction.guild, error, 'interactionCreate');

    const payload = {
      content: '❌ An unexpected error occurred while processing this interaction.',
      ephemeral: true,
    };

    try {
      if (interaction.isRepliable()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(payload);
        } else {
          await interaction.reply(payload);
        }
      }
    } catch {
      // Ignore secondary failures
    }
  }
}
