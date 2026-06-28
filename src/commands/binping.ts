import type { ChatInputCommandInteraction } from 'discord.js';

export async function handleBinpingCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({ content: 'Discord interaction received!' });
}
