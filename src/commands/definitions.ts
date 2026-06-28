import {
  SlashCommandBuilder,
  REST,
  Routes,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { AppConfig } from '../types';

export interface CommandDefinition {
  data: SlashCommandBuilder;
  adminOnly: boolean;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commandDefinitions = [
  new SlashCommandBuilder()
    .setName('task')
    .setDescription('Manage cleaning tasks')
    .addSubcommand((sub) => sub.setName('create').setDescription('Create a new cleaning task'))
    .addSubcommand((sub) =>
      sub
        .setName('edit')
        .setDescription('Edit an existing cleaning task')
        .addIntegerOption((option) =>
          option.setName('task_id').setDescription('Task ID').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Deactivate a cleaning task')
        .addIntegerOption((option) =>
          option.setName('task_id').setDescription('Task ID').setRequired(true),
        ),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List all cleaning tasks'))
    .addSubcommand((sub) =>
      sub.setName('manage').setDescription('Manage cleaning tasks with buttons and forms'),
    ),
  new SlashCommandBuilder()
    .setName('rota')
    .setDescription('Manage the cleaning rota')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a user to the rota')
        .addUserOption((option) =>
          option.setName('user').setDescription('Discord user to add').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a user from the rota')
        .addUserOption((option) =>
          option.setName('user').setDescription('Discord user to remove').setRequired(true),
        ),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List rota users')),
  new SlashCommandBuilder()
    .setName('report')
    .setDescription('Export assignment history as CSV (admin only)'),
  new SlashCommandBuilder()
    .setName('bins')
    .setDescription('Show upcoming Leeds bin collection dates')
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName('binping')
    .setDescription('Test the Discord interaction endpoint')
    .setDMPermission(false),
] as const;

export async function registerSlashCommands(config: AppConfig): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  const body = commandDefinitions.map((command) => command.toJSON());

  await rest.put(Routes.applicationCommands(config.clientId), { body });
  console.log(`Registered ${body.length} global slash command(s).`);
}
