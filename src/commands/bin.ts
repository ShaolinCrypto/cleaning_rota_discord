import type { ChatInputCommandInteraction } from 'discord.js';
import { handleBinsCommand } from './bins';
import { handleBinpingCommand } from './binping';

const BIN_COMMANDS = new Set(['bins', 'binping']);

export function isBinCommand(commandName: string): boolean {
  return BIN_COMMANDS.has(commandName);
}

export async function handleBinCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  switch (interaction.commandName) {
    case 'bins':
      await handleBinsCommand(interaction);
      break;
    case 'binping':
      await handleBinpingCommand(interaction);
      break;
    default:
      await interaction.reply({ content: 'Unknown command.', ephemeral: true });
  }
}
