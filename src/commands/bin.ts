import type { ChatInputCommandInteraction } from 'discord.js';
import { loadConfig } from '../config';
import { requireBinChannel } from '../utils/channels';
import { handleBinsCommand } from './bins';

export function isBinsCommand(commandName: string): boolean {
  return commandName === 'bins';
}

export async function handleBinsSlashCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const config = loadConfig();
  requireBinChannel(interaction, config.binChannelId);
  await handleBinsCommand(interaction);
}
