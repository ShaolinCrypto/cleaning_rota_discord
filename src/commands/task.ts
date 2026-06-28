import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import { createTask, editTask, getTaskById, listTasks, removeTask } from '../services/taskService';
import { ValidationError } from '../utils/errors';
import { requireAdmin, requireAdminForButton } from '../utils/permissions';
import {
  buildCreateTaskModal,
  buildEditTaskModal,
  buildTaskConfirmationEmbed,
  buildTaskManageComponents,
  buildTaskManageEmbed,
  parseTaskEditModalId,
  parseTaskManageActionId,
  readTaskModalFields,
  TASK_CREATE_MODAL_ID,
  TASK_EDIT_MODAL_PREFIX,
  TASK_MANAGE_ADD,
  TASK_MANAGE_CANCEL,
  TASK_MANAGE_EDIT_PREFIX,
  TASK_MANAGE_REFRESH,
  TASK_MANAGE_REMOVE_PREFIX,
  TASK_MANAGE_SELECT,
} from '../utils/taskUi';

const MODAL_SUBCOMMANDS = new Set(['create', 'edit', 'manage']);

export function taskUsesModalOrComponents(subcommand: string): boolean {
  return MODAL_SUBCOMMANDS.has(subcommand);
}

export async function handleTaskCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await requireAdmin(interaction);

  const subcommand = interaction.options.getSubcommand(true);

  switch (subcommand) {
    case 'create':
      await interaction.showModal(buildCreateTaskModal());
      break;
    case 'edit': {
      const taskId = interaction.options.getInteger('task_id', true);
      const task = getTaskById(taskId);
      await interaction.showModal(buildEditTaskModal(task));
      break;
    }
    case 'manage':
      await replyTaskManage(interaction);
      break;
    case 'remove': {
      const taskId = interaction.options.getInteger('task_id', true);
      const task = removeTask(taskId);
      await interaction.editReply({
        embeds: [buildTaskConfirmationEmbed('removed', task)],
      });
      break;
    }
    case 'list': {
      const tasks = listTasks(true);
      if (tasks.length === 0) {
        await interaction.editReply({ content: 'No tasks found.' });
        return;
      }

      const lines = tasks.map(
        (task) =>
          `**#${task.id}** ${task.active ? '✅' : '❌'} ${task.title}\n> ${task.description || '_No description_'}`,
      );

      await interaction.editReply({
        content: `**Cleaning Tasks**\n\n${lines.join('\n\n')}`,
      });
      break;
    }
    default:
      await interaction.editReply({ content: 'Unknown subcommand.' });
  }
}

async function replyTaskManage(
  interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction,
  selectedTaskId?: number,
): Promise<void> {
  const tasks = listTasks(true);
  const payload = {
    embeds: [buildTaskManageEmbed(tasks, selectedTaskId)],
    components: buildTaskManageComponents(tasks, selectedTaskId),
    ephemeral: true,
  };

  if (interaction.isChatInputCommand()) {
    await interaction.reply(payload);
    return;
  }

  await interaction.update(payload);
}

export async function handleTaskModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  await requireAdmin(interaction);

  if (interaction.customId === TASK_CREATE_MODAL_ID) {
    let fields;
    try {
      fields = readTaskModalFields(interaction);
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : 'Invalid task fields.');
    }

    await interaction.deferReply({ ephemeral: true });
    const task = createTask(fields.title, fields.description);
    await interaction.editReply({ embeds: [buildTaskConfirmationEmbed('created', task)] });
    return;
  }

  const taskId = parseTaskEditModalId(interaction.customId);
  if (taskId !== null) {
    getTaskById(taskId);

    let fields;
    try {
      fields = readTaskModalFields(interaction);
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : 'Invalid task fields.');
    }

    await interaction.deferReply({ ephemeral: true });
    const task = editTask(taskId, fields.title, fields.description);
    await interaction.editReply({ embeds: [buildTaskConfirmationEmbed('updated', task)] });
    return;
  }

  throw new ValidationError('Unknown task modal.');
}

export async function handleTaskButton(interaction: ButtonInteraction): Promise<void> {
  await requireAdminForButton(interaction);

  if (interaction.customId === TASK_MANAGE_ADD) {
    await interaction.showModal(buildCreateTaskModal());
    return;
  }

  if (interaction.customId === TASK_MANAGE_REFRESH) {
    await replyTaskManage(interaction);
    return;
  }

  if (interaction.customId === TASK_MANAGE_CANCEL) {
    await replyTaskManage(interaction);
    return;
  }

  const editTaskId = parseTaskManageActionId(interaction.customId, TASK_MANAGE_EDIT_PREFIX);
  if (editTaskId !== null) {
    const task = getTaskById(editTaskId);
    await interaction.showModal(buildEditTaskModal(task));
    return;
  }

  const removeTaskId = parseTaskManageActionId(interaction.customId, TASK_MANAGE_REMOVE_PREFIX);
  if (removeTaskId !== null) {
    const task = removeTask(removeTaskId);
    await interaction.update({
      embeds: [buildTaskConfirmationEmbed('removed', task)],
      components: [],
    });
    return;
  }

  throw new ValidationError('Unknown task button.');
}

export async function handleTaskSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  await requireAdmin(interaction);

  if (interaction.customId !== TASK_MANAGE_SELECT) {
    throw new ValidationError('Unknown task select menu.');
  }

  const selectedTaskId = Number.parseInt(interaction.values[0], 10);
  if (Number.isNaN(selectedTaskId)) {
    throw new ValidationError('Invalid task selection.');
  }

  getTaskById(selectedTaskId);
  await replyTaskManage(interaction, selectedTaskId);
}

export function isTaskModal(customId: string): boolean {
  return customId === TASK_CREATE_MODAL_ID || customId.startsWith(TASK_EDIT_MODAL_PREFIX);
}

export function isTaskManageButton(customId: string): boolean {
  return customId.startsWith('task_manage_');
}

export function isTaskManageSelect(customId: string): boolean {
  return customId === TASK_MANAGE_SELECT;
}
