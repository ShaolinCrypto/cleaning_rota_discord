import {
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type Interaction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { handleCommand } from '../commands';
import { handleBinCommand, isBinCommand } from '../commands/bin';
import {
  handleTaskButton,
  handleTaskCommand,
  handleTaskModalSubmit,
  handleTaskSelectMenu,
  isTaskManageButton,
  isTaskManageSelect,
  isTaskModal,
  taskUsesModalOrComponents,
} from '../commands/task';
import {
  getAssignmentById,
  refreshAssignmentMessage,
  updateAssignmentStatus,
} from '../services/assignmentService';
import { parseButtonCustomId } from '../utils/embeds';
import { requireAdminForButton, requireAssignedUser } from '../utils/permissions';
import { isBotError, ValidationError } from '../utils/errors';

async function handleAssignmentButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseButtonCustomId(interaction.customId);
  if (!parsed) {
    return;
  }

  const assignment = getAssignmentById(parsed.assignmentId);

  switch (parsed.action) {
    case 'accept': {
      await requireAssignedUser(interaction, assignment.userId);

      if (assignment.status !== 'Assigned') {
        throw new ValidationError('This assignment has already been accepted or completed.');
      }

      const updated = updateAssignmentStatus(assignment.id, 'Accepted');
      await refreshAssignmentMessage(interaction.client, updated);

      await interaction.reply({
        content: 'Assignment accepted. Please confirm completion when finished.',
        ephemeral: true,
      });
      break;
    }
    case 'complete': {
      await requireAssignedUser(interaction, assignment.userId);

      if (assignment.status !== 'Accepted') {
        throw new ValidationError('You must accept the assignment before confirming completion.');
      }

      const updated = updateAssignmentStatus(assignment.id, 'Complete');
      await refreshAssignmentMessage(interaction.client, updated);

      await interaction.reply({
        content: 'Assignment marked as complete. Thank you!',
        ephemeral: true,
      });
      break;
    }
    case 'not_complete': {
      await requireAdminForButton(interaction);

      if (assignment.status === 'Complete' || assignment.status === 'Not Complete') {
        throw new ValidationError('This assignment cannot be marked as not complete.');
      }

      const updated = updateAssignmentStatus(assignment.id, 'Not Complete');
      await refreshAssignmentMessage(interaction.client, updated);

      await interaction.reply({
        content: 'Assignment marked as not complete.',
        ephemeral: true,
      });
      break;
    }
    default:
      await interaction.reply({ content: 'Unknown button action.', ephemeral: true });
  }
}

function shouldDeferRotaCommand(interaction: ChatInputCommandInteraction): boolean {
  if (interaction.commandName !== 'task') {
    return true;
  }

  const subcommand = interaction.options.getSubcommand(false);
  if (!subcommand) {
    return true;
  }

  return !taskUsesModalOrComponents(subcommand);
}

export function registerInteractionCreateEvent(client: Client): void {
  client.on('interactionCreate', async (interaction: Interaction) => {
    const isCommand = interaction.isChatInputCommand();
    const isAssignmentButton =
      interaction.isButton() && interaction.customId.startsWith('assignment:');
    const isTaskButton = interaction.isButton() && isTaskManageButton(interaction.customId);
    const isTaskSelect = interaction.isStringSelectMenu() && isTaskManageSelect(interaction.customId);
    const isTaskModalSubmit = interaction.isModalSubmit() && isTaskModal(interaction.customId);

    if (!isCommand && !isAssignmentButton && !isTaskButton && !isTaskSelect && !isTaskModalSubmit) {
      return;
    }

    try {
      if (isCommand) {
        const commandInteraction = interaction as ChatInputCommandInteraction;

        if (isBinCommand(commandInteraction.commandName)) {
          await handleBinCommand(commandInteraction);
          return;
        }

        if (shouldDeferRotaCommand(commandInteraction)) {
          await commandInteraction.deferReply({ ephemeral: true });
        }

        await handleCommand(commandInteraction);
        return;
      }

      if (isTaskModalSubmit) {
        await handleTaskModalSubmit(interaction as ModalSubmitInteraction);
        return;
      }

      if (isTaskButton) {
        await handleTaskButton(interaction as ButtonInteraction);
        return;
      }

      if (isTaskSelect) {
        await handleTaskSelectMenu(interaction as StringSelectMenuInteraction);
        return;
      }

      if (isAssignmentButton) {
        await handleAssignmentButtonInteraction(interaction as ButtonInteraction);
      }
    } catch (error) {
      const message = isBotError(error)
        ? error.userMessage
        : 'An unexpected error occurred. Please try again later.';

      console.error('Interaction error:', error instanceof Error ? error.message : error, error);

      if (interaction.isRepliable()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: message }).catch(() => undefined);
        } else {
          await interaction.reply({ content: message, ephemeral: true }).catch(() => undefined);
        }
      }
    }
  });
}
