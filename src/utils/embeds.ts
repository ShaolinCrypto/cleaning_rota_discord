import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
} from 'discord.js';
import type { AssignmentStatus, AssignmentWithDetails } from '../types';

const STATUS_COLORS: Record<AssignmentStatus, number> = {
  Assigned: 0x3498db,
  Accepted: 0xf1c40f,
  Complete: 0x2ecc71,
  'Not Complete': 0xe74c3c,
};

export function buildAssignmentEmbed(
  assignment: AssignmentWithDetails,
  member?: GuildMember | null,
): EmbedBuilder {
  const userDisplay = member ? `<@${assignment.userId}>` : `<@${assignment.userId}>`;

  return new EmbedBuilder()
    .setTitle(`🧹 ${assignment.taskTitle}`)
    .setDescription(assignment.taskDescription || 'No description provided.')
    .setColor(STATUS_COLORS[assignment.status])
    .addFields(
      { name: 'Assigned User', value: userDisplay, inline: true },
      { name: 'Week', value: assignment.weekDate, inline: true },
      { name: 'Status', value: assignment.status, inline: true },
    )
    .setFooter({ text: `Assignment ID: ${assignment.id}` })
    .setTimestamp(new Date(assignment.createdAt));
}

export function buildAssignmentButtons(
  assignment: AssignmentWithDetails,
): ActionRowBuilder<ButtonBuilder>[] {
  if (assignment.status === 'Complete' || assignment.status === 'Not Complete') {
    return [];
  }

  const userRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`assignment:accept:${assignment.id}`)
      .setLabel('Accept')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(assignment.status !== 'Assigned'),
    new ButtonBuilder()
      .setCustomId(`assignment:complete:${assignment.id}`)
      .setLabel('Confirm Complete')
      .setStyle(ButtonStyle.Success)
      .setDisabled(assignment.status !== 'Accepted'),
  );

  const adminRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`assignment:not_complete:${assignment.id}`)
      .setLabel('Not Complete')
      .setStyle(ButtonStyle.Danger),
  );

  return [userRow, adminRow];
}

export function buttonCustomId(action: string, assignmentId: number): string {
  return `assignment:${action}:${assignmentId}`;
}

export function parseButtonCustomId(customId: string): { action: string; assignmentId: number } | null {
  const match = /^assignment:(accept|complete|not_complete):(\d+)$/.exec(customId);
  if (!match) {
    return null;
  }
  return {
    action: match[1],
    assignmentId: Number.parseInt(match[2], 10),
  };
}
