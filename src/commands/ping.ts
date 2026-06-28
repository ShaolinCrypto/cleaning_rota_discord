import type { ChatInputCommandInteraction } from 'discord.js';
import { loadConfig } from '../config';
import { requireRotaOrBinChannel } from '../utils/channels';

export function isPingCommand(commandName: string): boolean {
  return commandName === 'ping';
}

export async function handlePingSlashCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const config = loadConfig();
  requireRotaOrBinChannel(interaction, config.rotaChannelId, config.binChannelId);
  await interaction.reply({ content: 'Discord interaction received!' });
}
