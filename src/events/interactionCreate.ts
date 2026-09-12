import { Interaction } from 'discord.js';
import { isTicketButton, routeTicketButton } from '../services/ticketService';
import { logError } from '../services/loggingService';
import { isNexusCustomId, NEXUS_IDS } from '../config/contentMapping';
import {
  handleContentButton,
  handleContentModal,
  handleContentSelect,
} from '../services/contentManagerService';
import {
  handleShopCategoryButton,
  handleShopPickSelect,
  handleShopRootButton,
} from '../services/discordShopBrowseService';
import {
  handleBuyButton,
  handleBuyCancel,
  handleBuyConfirm,
  handleInfoButton,
} from '../services/purchaseService';

export async function interactionCreateHandler(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        await interaction
          .reply({ content: '❌ Unknown command.', ephemeral: true })
          .catch(() => undefined);
        return;
      }
      await command.execute(interaction);
      return;
    }

    if (interaction.isModalSubmit() && isNexusCustomId(interaction.customId)) {
      await handleContentModal(interaction);
      return;
    }

    if (interaction.isStringSelectMenu() && isNexusCustomId(interaction.customId)) {
      if (interaction.customId.includes(':pick:')) {
        await handleShopPickSelect(interaction);
        return;
      }
      await handleContentSelect(interaction);
      return;
    }

    if (interaction.isButton()) {
      const id = interaction.customId;

      if (isTicketButton(id)) {
        await routeTicketButton(interaction);
        return;
      }

      if (!isNexusCustomId(id)) return;

      if (id === NEXUS_IDS.SHOP_ROOT) {
        await handleShopRootButton(interaction);
        return;
      }
      if (id.startsWith(`${NEXUS_IDS.SHOP_CAT}:`) && !id.includes(':pick:')) {
        await handleShopCategoryButton(interaction);
        return;
      }
      if (id.startsWith(`${NEXUS_IDS.BUY_CONFIRM}:`)) {
        await handleBuyConfirm(interaction);
        return;
      }
      if (id === NEXUS_IDS.BUY_CANCEL) {
        await handleBuyCancel(interaction);
        return;
      }
      if (id.startsWith(`${NEXUS_IDS.BUY}:`)) {
        await handleBuyButton(interaction);
        return;
      }
      if (id.startsWith(`${NEXUS_IDS.INFO}:`)) {
        await handleInfoButton(interaction);
        return;
      }

      await handleContentButton(interaction);
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
      // ignore
    }
  }
}
