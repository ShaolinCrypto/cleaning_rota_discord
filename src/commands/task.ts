import type { ChatInputCommandInteraction } from 'discord.js';
import { createTask, editTask, listTasks, removeTask } from '../services/taskService';
import { requireAdmin } from '../utils/permissions';

export async function handleTaskCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await requireAdmin(interaction);

  const subcommand = interaction.options.getSubcommand(true);

  switch (subcommand) {
    case 'create': {
      const title = interaction.options.getString('title', true);
      const description = interaction.options.getString('description', true);
      const task = createTask(title, description);
      await interaction.reply({
        content: `Created task **#${task.id}**: ${task.title}`,
        ephemeral: true,
      });
      break;
    }
    case 'edit': {
      const taskId = interaction.options.getInteger('task_id', true);
      const title = interaction.options.getString('title', true);
      const description = interaction.options.getString('description', true);
      const task = editTask(taskId, title, description);
      await interaction.reply({
        content: `Updated task **#${task.id}**: ${task.title}`,
        ephemeral: true,
      });
      break;
    }
    case 'remove': {
      const taskId = interaction.options.getInteger('task_id', true);
      const task = removeTask(taskId);
      await interaction.reply({
        content: `Deactivated task **#${task.id}**: ${task.title}`,
        ephemeral: true,
      });
      break;
    }
    case 'list': {
      const tasks = listTasks(true);
      if (tasks.length === 0) {
        await interaction.reply({ content: 'No tasks found.', ephemeral: true });
        return;
      }

      const lines = tasks.map(
        (task) =>
          `**#${task.id}** ${task.active ? '✅' : '❌'} ${task.title}\n> ${task.description || '_No description_'}`,
      );

      await interaction.reply({
        content: `**Cleaning Tasks**\n\n${lines.join('\n\n')}`,
        ephemeral: true,
      });
      break;
    }
    default:
      await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
}
