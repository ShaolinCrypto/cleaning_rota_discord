import type { ChatInputCommandInteraction } from 'discord.js';
import { handleTaskCommand } from './task';
import { handleRotaCommand } from './rota';
import { handleReportCommand } from './report';

const handlers: Record<string, (interaction: ChatInputCommandInteraction) => Promise<void>> = {
  task: handleTaskCommand,
  rota: handleRotaCommand,
  report: handleReportCommand,
};

export async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const handler = handlers[interaction.commandName];
  if (!handler) {
    await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    return;
  }

  await handler(interaction);
}
