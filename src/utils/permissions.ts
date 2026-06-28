import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  GuildMember,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { PermissionError } from './errors';

export function isAdmin(member: GuildMember | null): boolean {
  if (!member) {
    return false;
  }
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

export async function requireAdmin(
  interaction:
    | ChatInputCommandInteraction
    | ButtonInteraction
    | ModalSubmitInteraction
    | StringSelectMenuInteraction,
): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!isAdmin(member)) {
    throw new PermissionError('This command requires administrator permissions.');
  }
}

export async function requireAssignedUser(
  interaction: ButtonInteraction,
  assignedUserId: string,
): Promise<void> {
  if (interaction.user.id !== assignedUserId) {
    throw new PermissionError('Only the assigned user can use this button.');
  }
}

export async function requireAdminForButton(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!isAdmin(member)) {
    throw new PermissionError('Only administrators can use this button.');
  }
}
