import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type { Task } from '../types';

export const TASK_TITLE_MAX = 200;
export const TASK_DESCRIPTION_MAX = 2000;

const TASK_INPUT_TITLE = 'task_title';
const TASK_INPUT_DESCRIPTION = 'task_description';

export const TASK_CREATE_MODAL_ID = 'task_create_modal';
export const TASK_EDIT_MODAL_PREFIX = 'task_edit_modal:';
export const TASK_MANAGE_ADD = 'task_manage_add';
export const TASK_MANAGE_REFRESH = 'task_manage_refresh';
export const TASK_MANAGE_SELECT = 'task_manage_select';
export const TASK_MANAGE_EDIT_PREFIX = 'task_manage_edit:';
export const TASK_MANAGE_REMOVE_PREFIX = 'task_manage_remove:';
export const TASK_MANAGE_CANCEL = 'task_manage_cancel';

export function parseTaskEditModalId(customId: string): number | null {
  const match = /^task_edit_modal:(\d+)$/.exec(customId);
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1], 10);
}

export function parseTaskManageActionId(
  customId: string,
  prefix: string,
): number | null {
  if (!customId.startsWith(prefix)) {
    return null;
  }
  const id = Number.parseInt(customId.slice(prefix.length), 10);
  return Number.isNaN(id) ? null : id;
}

export function validateTaskFields(title: string, description: string): {
  title: string;
  description: string;
} {
  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();

  if (!trimmedTitle) {
    throw new Error('Task title cannot be empty.');
  }
  if (trimmedTitle.length > TASK_TITLE_MAX) {
    throw new Error(`Task title must be ${TASK_TITLE_MAX} characters or fewer.`);
  }
  if (trimmedDescription.length > TASK_DESCRIPTION_MAX) {
    throw new Error(`Task description must be ${TASK_DESCRIPTION_MAX} characters or fewer.`);
  }

  return { title: trimmedTitle, description: trimmedDescription };
}

export function readTaskModalFields(
  modal: import('discord.js').ModalSubmitInteraction,
): { title: string; description: string } {
  const title = modal.fields.getTextInputValue(TASK_INPUT_TITLE);
  const description = modal.fields.getTextInputValue(TASK_INPUT_DESCRIPTION);
  return validateTaskFields(title, description);
}

function buildTaskFormModal(customId: string, title: string, task?: Task): ModalBuilder {
  const titleInput = new TextInputBuilder()
    .setCustomId(TASK_INPUT_TITLE)
    .setLabel('Task Title')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(TASK_TITLE_MAX)
    .setPlaceholder('e.g. Clean kitchen');

  const descriptionInput = new TextInputBuilder()
    .setCustomId(TASK_INPUT_DESCRIPTION)
    .setLabel('Task Description')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(TASK_DESCRIPTION_MAX)
    .setPlaceholder('Describe what needs to be done');

  if (task) {
    titleInput.setValue(task.title.slice(0, TASK_TITLE_MAX));
    descriptionInput.setValue(task.description.slice(0, TASK_DESCRIPTION_MAX));
  }

  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
    );
}

export function buildCreateTaskModal(): ModalBuilder {
  return buildTaskFormModal(TASK_CREATE_MODAL_ID, 'Create Cleaning Task');
}

export function buildEditTaskModal(task: Task): ModalBuilder {
  return buildTaskFormModal(`${TASK_EDIT_MODAL_PREFIX}${task.id}`, `Edit Task #${task.id}`);
}

export function buildTaskConfirmationEmbed(
  action: 'created' | 'updated' | 'removed',
  task: Task,
): EmbedBuilder {
  const titles = {
    created: '✅ Task Created',
    updated: '✅ Task Updated',
    removed: '✅ Task Deactivated',
  };

  return new EmbedBuilder()
    .setTitle(titles[action])
    .setColor(action === 'removed' ? 0xe74c3c : 0x2ecc71)
    .addFields(
      { name: 'ID', value: `#${task.id}`, inline: true },
      { name: 'Status', value: task.active ? 'Active' : 'Inactive', inline: true },
      { name: 'Title', value: task.title },
      { name: 'Description', value: task.description || '_No description_' },
    );
}

function formatTaskLine(task: Task): string {
  const status = task.active ? '✅ Active' : '❌ Inactive';
  return `**#${task.id}** · ${status}\n**${task.title}**\n${task.description || '_No description_'}`;
}

export function buildTaskManageEmbed(tasks: Task[], selectedTaskId?: number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🧹 Manage Cleaning Tasks')
    .setColor(0x5865f2)
    .setDescription(
      tasks.length === 0
        ? 'No tasks found. Use **Add Task** to create one.'
        : 'Select a task below, then choose **Edit Selected** or **Remove Selected**.',
    );

  if (tasks.length > 0) {
    const listing = tasks
      .slice(0, 10)
      .map((task) => formatTaskLine(task))
      .join('\n\n');
    embed.addFields({ name: 'Tasks', value: listing });
    if (tasks.length > 10) {
      embed.setFooter({ text: `Showing 10 of ${tasks.length} tasks in the embed.` });
    }
  }

  if (selectedTaskId !== undefined) {
    const selected = tasks.find((task) => task.id === selectedTaskId);
    if (selected) {
      embed.addFields({
        name: 'Selected',
        value: formatTaskLine(selected),
      });
    }
  }

  return embed;
}

export function buildTaskManageComponents(
  tasks: Task[],
  selectedTaskId?: number,
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];

  const toolbar = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(TASK_MANAGE_ADD)
      .setLabel('Add Task')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(TASK_MANAGE_REFRESH)
      .setLabel('Refresh List')
      .setStyle(ButtonStyle.Secondary),
  );
  rows.push(toolbar);

  if (tasks.length > 0) {
    const options = tasks.slice(0, 25).map((task) => ({
      label: `#${task.id} ${task.title}`.slice(0, 100),
      description: (task.active ? 'Active' : 'Inactive').slice(0, 100),
      value: task.id.toString(),
      default: task.id === selectedTaskId,
    }));

    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(TASK_MANAGE_SELECT)
          .setPlaceholder('Select a task')
          .addOptions(options),
      ),
    );

    if (selectedTaskId !== undefined) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`${TASK_MANAGE_EDIT_PREFIX}${selectedTaskId}`)
            .setLabel('Edit Selected')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`${TASK_MANAGE_REMOVE_PREFIX}${selectedTaskId}`)
            .setLabel('Remove Selected')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(TASK_MANAGE_CANCEL)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary),
        ),
      );
    }
  }

  return rows;
}
