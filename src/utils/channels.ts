import type { ChatInputCommandInteraction } from 'discord.js';
import { ValidationError } from './errors';

export function requireRotaChannel(
  interaction: ChatInputCommandInteraction,
  rotaChannelId: string,
): void {
  if (interaction.channelId !== rotaChannelId) {
    throw new ValidationError(`This command can only be used in <#${rotaChannelId}>.`);
  }
}

export function requireBinChannel(
  interaction: ChatInputCommandInteraction,
  binChannelId: string,
): void {
  if (interaction.channelId !== binChannelId) {
    throw new ValidationError(`This command can only be used in <#${binChannelId}>.`);
  }
}

export function requireRotaOrBinChannel(
  interaction: ChatInputCommandInteraction,
  rotaChannelId: string,
  binChannelId: string,
): void {
  if (interaction.channelId === rotaChannelId || interaction.channelId === binChannelId) {
    return;
  }

  throw new ValidationError(
    `This command can only be used in <#${rotaChannelId}> or <#${binChannelId}>.`,
  );
}
