import type { ChatInputCommandInteraction } from 'discord.js';
import { loadConfig } from '../config';
import { getHealthReport } from '../services/healthService';
import { requireRotaOrBinChannel } from '../utils/channels';

export function isHealthCommand(commandName: string): boolean {
  return commandName === 'health';
}

export async function handleHealthSlashCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const config = loadConfig();
  requireRotaOrBinChannel(interaction, config.rotaChannelId, config.binChannelId);

  const report = await getHealthReport(config);
  await interaction.reply({ content: report, ephemeral: true });
}
