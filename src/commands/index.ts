import type { ChatInputCommandInteraction } from 'discord.js';
import { loadConfig } from '../config';
import { requireRotaChannel } from '../utils/channels';
import { handleTaskCommand } from './task';
import { handleRotaCommand } from './rota';
import { handleReportCommand } from './report';

const handlers: Record<string, (interaction: ChatInputCommandInteraction) => Promise<void>> = {
  task: handleTaskCommand,
  rota: handleRotaCommand,
  report: handleReportCommand,
};

export async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const config = loadConfig();
  requireRotaChannel(interaction, config.rotaChannelId);

  const handler = handlers[interaction.commandName];
  if (!handler) {
    await interaction.editReply({ content: 'Unknown command.' });
    return;
  }

  await handler(interaction);
}
