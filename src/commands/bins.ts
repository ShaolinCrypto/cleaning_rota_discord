import type { ChatInputCommandInteraction } from 'discord.js';
import { loadConfig } from '../config';
import { fetchBinCollections } from '../services/binService';
import { buildBinsEmbed } from '../utils/binEmbeds';

async function replyBinsError(
  interaction: ChatInputCommandInteraction,
  message: string,
): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.deleteReply().catch(() => undefined);
    await interaction.followUp({ content: message, ephemeral: true });
    return;
  }

  await interaction.reply({ content: message, ephemeral: true });
}

export async function handleBinsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const config = loadConfig();

  if (!config.premisesId) {
    await replyBinsError(interaction, 'PREMISES_ID is not configured on the server.');
    return;
  }

  await interaction.deferReply();

  try {
    const result = await fetchBinCollections(config);

    if (result.kind === 'config_error' || result.kind === 'api_error') {
      await replyBinsError(interaction, result.message);
      return;
    }

    const embed = buildBinsEmbed(result.collections);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('bins command failed:', error);
    await replyBinsError(
      interaction,
      'Something went wrong fetching bin dates. Please try again.',
    );
  }
}
