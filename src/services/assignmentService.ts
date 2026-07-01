import type { Client, TextChannel } from 'discord.js';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { execute, queryOne, queryRows, withTransaction } from '../db';
import { getActiveTasks } from './taskService';
import { getRotationIndex, listRotaUsers, setRotationIndex } from './rotaService';
import { buildAssignmentButtons, buildAssignmentEmbed } from '../utils/embeds';
import {
  BotError,
  DatabaseError,
  ValidationError,
  wrapDatabaseErrorAsync,
  NotFoundError,
} from '../utils/errors';
import type {
  Assignment,
  AssignmentStatus,
  AssignmentWithDetails,
  WeeklyAssignmentResult,
} from '../types';

interface AssignmentRow extends RowDataPacket {
  id: number;
  week_date: string;
  task_id: number;
  user_id: string;
  status: AssignmentStatus;
  message_id: string | null;
  channel_id: string | null;
  created_at: string;
}

interface AssignmentWithDetailsRow extends AssignmentRow {
  task_title: string;
  task_description: string;
}

function mapAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    weekDate: row.week_date,
    taskId: row.task_id,
    userId: row.user_id,
    status: row.status,
    messageId: row.message_id,
    channelId: row.channel_id,
    createdAt: row.created_at,
  };
}

function mapAssignmentWithDetails(row: AssignmentWithDetailsRow): AssignmentWithDetails {
  return {
    ...mapAssignment(row),
    taskTitle: row.task_title,
    taskDescription: row.task_description,
  };
}

export function getWeekDate(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export async function getAssignmentById(assignmentId: number): Promise<AssignmentWithDetails> {
  return wrapDatabaseErrorAsync(async () => {
    const row = await queryOne<AssignmentWithDetailsRow>(
      `
        SELECT a.*, t.title AS task_title, t.description AS task_description
        FROM assignments a
        INNER JOIN tasks t ON t.id = a.task_id
        WHERE a.id = ?
      `,
      [assignmentId],
    );

    if (!row) {
      throw new NotFoundError('Assignment', assignmentId);
    }

    return mapAssignmentWithDetails(row);
  });
}

export async function hasAssignmentsForWeek(weekDate: string): Promise<boolean> {
  return wrapDatabaseErrorAsync(async () => {
    const row = await queryOne<RowDataPacket & { count: number }>(
      'SELECT COUNT(*) AS count FROM assignments WHERE week_date = ?',
      [weekDate],
    );
    return Number(row?.count ?? 0) > 0;
  });
}

export async function createWeeklyAssignments(
  weekDate: string = getWeekDate(),
): Promise<WeeklyAssignmentResult> {
  return wrapDatabaseErrorAsync(async () => {
    const users = await listRotaUsers();
    const tasks = await getActiveTasks();
    const warnings: string[] = [];

    if (users.length === 0) {
      throw new ValidationError('Cannot create assignments: no users on the rota.');
    }

    if (tasks.length === 0) {
      throw new ValidationError('Cannot create assignments: no active tasks.');
    }

    if (await hasAssignmentsForWeek(weekDate)) {
      throw new ValidationError(`Assignments for week ${weekDate} have already been created.`);
    }

    const assignmentCount = Math.min(users.length, tasks.length);

    if (users.length > tasks.length) {
      warnings.push(
        `More rota users (${users.length}) than active tasks (${tasks.length}). ` +
          `${users.length - tasks.length} user(s) will not receive a task this week.`,
      );
    }

    if (tasks.length > users.length) {
      warnings.push(
        `More active tasks (${tasks.length}) than rota users (${users.length}). ` +
          `${tasks.length - users.length} task(s) will remain unassigned this week.`,
      );
    }

    const rotationIndex = await getRotationIndex();
    const createdAt = new Date().toISOString();
    const createdIds = await withTransaction(async (connection: PoolConnection) => {
      const ids: number[] = [];

      for (let slot = 0; slot < assignmentCount; slot += 1) {
        const user = users[(rotationIndex + slot) % users.length];
        const task = tasks[(rotationIndex + slot) % tasks.length];

        const [result] = await connection.execute<import('mysql2/promise').ResultSetHeader>(
          `
            INSERT INTO assignments (week_date, task_id, user_id, status, created_at)
            VALUES (?, ?, ?, 'Assigned', ?)
          `,
          [weekDate, task.id, user.userId, createdAt],
        );
        ids.push(result.insertId);
      }

      await connection.execute('UPDATE rota_state SET rotation_index = ? WHERE id = 1', [
        (rotationIndex + assignmentCount) % users.length,
      ]);

      return ids;
    });

    const assignments = await Promise.all(createdIds.map((id) => getAssignmentById(id)));
    return { assignments, warnings };
  });
}

export async function updateAssignmentStatus(
  assignmentId: number,
  status: AssignmentStatus,
): Promise<AssignmentWithDetails> {
  return wrapDatabaseErrorAsync(async () => {
    const existing = await queryOne<RowDataPacket>('SELECT id FROM assignments WHERE id = ?', [
      assignmentId,
    ]);
    if (!existing) {
      throw new NotFoundError('Assignment', assignmentId);
    }

    await execute('UPDATE assignments SET status = ? WHERE id = ?', [status, assignmentId]);
    return getAssignmentById(assignmentId);
  });
}

export async function setAssignmentMessage(
  assignmentId: number,
  messageId: string,
  channelId: string,
): Promise<void> {
  await wrapDatabaseErrorAsync(async () => {
    await execute('UPDATE assignments SET message_id = ?, channel_id = ? WHERE id = ?', [
      messageId,
      channelId,
      assignmentId,
    ]);
  });
}

export async function getAssignmentsForWeek(weekDate: string): Promise<AssignmentWithDetails[]> {
  return wrapDatabaseErrorAsync(async () => {
    const rows = await queryRows<AssignmentWithDetailsRow>(
      `
        SELECT a.*, t.title AS task_title, t.description AS task_description
        FROM assignments a
        INNER JOIN tasks t ON t.id = a.task_id
        WHERE a.week_date = ?
        ORDER BY a.id ASC
      `,
      [weekDate],
    );

    return rows.map(mapAssignmentWithDetails);
  });
}

export async function deleteAssignmentsForWeek(weekDate: string): Promise<number> {
  return wrapDatabaseErrorAsync(async () => {
    const result = await execute('DELETE FROM assignments WHERE week_date = ?', [weekDate]);
    return result.affectedRows;
  });
}

async function deleteAssignmentMessages(
  client: Client,
  assignments: AssignmentWithDetails[],
): Promise<void> {
  for (const assignment of assignments) {
    if (!assignment.messageId || !assignment.channelId) {
      continue;
    }

    try {
      const channel = await client.channels.fetch(assignment.channelId);
      if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        continue;
      }

      const message = await channel.messages.fetch(assignment.messageId);
      await message.delete();
    } catch (error) {
      console.warn(`Could not delete assignment message ${assignment.id}:`, error);
    }
  }
}

export async function buildWeeklyRota(
  client: Client,
  channelId: string,
  weekDate: string = getWeekDate(),
): Promise<WeeklyAssignmentResult> {
  const existing = await getAssignmentsForWeek(weekDate);
  const warnings: string[] = [];

  if (existing.length > 0) {
    warnings.push(`Replaced ${existing.length} existing assignment(s) for week ${weekDate}.`);
    await deleteAssignmentMessages(client, existing);
    await deleteAssignmentsForWeek(weekDate);
  }

  const result = await postWeeklyAssignments(client, channelId, weekDate);
  return {
    assignments: result.assignments,
    warnings: [...warnings, ...result.warnings],
  };
}

export async function postWeeklyAssignments(
  client: Client,
  channelId: string,
  weekDate: string = getWeekDate(),
): Promise<WeeklyAssignmentResult> {
  let channel: TextChannel;
  try {
    const fetched = await client.channels.fetch(channelId);
    if (!fetched || !fetched.isTextBased() || fetched.isDMBased()) {
      throw new ValidationError(
        `Assignment channel ${channelId} was not found or is not a guild text channel.`,
      );
    }
    channel = fetched as TextChannel;
  } catch (error) {
    if (error instanceof BotError) {
      throw error;
    }
    throw new ValidationError(
      `Assignment channel ${channelId} was not found or the bot cannot access it.`,
    );
  }

  const botMember = channel.guild.members.me;
  if (botMember) {
    const permissions = channel.permissionsFor(botMember);
    if (
      !permissions?.has(['ViewChannel', 'SendMessages', 'EmbedLinks']) ||
      !permissions.has('ManageMessages')
    ) {
      throw new ValidationError(
        'The bot lacks required permissions in the assignment channel (ViewChannel, SendMessages, EmbedLinks).',
      );
    }
  }

  let result: WeeklyAssignmentResult;
  try {
    result = await createWeeklyAssignments(weekDate);
  } catch (error) {
    if (error instanceof ValidationError && error.message.includes('already been created')) {
      return {
        assignments: await getAssignmentsForWeek(weekDate),
        warnings: [`Assignments for week ${weekDate} already exist; reposting messages.`],
      };
    }
    throw error;
  }

  for (const assignment of result.assignments) {
    try {
      const member = await channel.guild.members.fetch(assignment.userId).catch(() => null);
      const embed = buildAssignmentEmbed(assignment, member);
      const components = buildAssignmentButtons(assignment);

      const message = await channel.send({
        content: `<@${assignment.userId}>`,
        embeds: [embed],
        components,
      });

      await setAssignmentMessage(assignment.id, message.id, channel.id);
      assignment.messageId = message.id;
      assignment.channelId = channel.id;
    } catch (error) {
      console.error(`Failed to post assignment ${assignment.id}:`, error);
      throw new DatabaseError(`Failed to post assignment for <@${assignment.userId}>.`);
    }
  }

  return result;
}

export async function refreshAssignmentMessage(
  client: Client,
  assignment: AssignmentWithDetails,
): Promise<void> {
  if (!assignment.messageId || !assignment.channelId) {
    return;
  }

  try {
    const channel = await client.channels.fetch(assignment.channelId);
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      return;
    }

    const message = await channel.messages.fetch(assignment.messageId);
    const member = await channel.guild.members.fetch(assignment.userId).catch(() => null);
    const embed = buildAssignmentEmbed(assignment, member);
    const components = buildAssignmentButtons(assignment);

    await message.edit({
      embeds: [embed],
      components,
    });
  } catch (error) {
    console.error(`Failed to refresh assignment message ${assignment.id}:`, error);
  }
}

export async function refreshAssignmentMessageForAll(
  client: Client,
  assignmentId: number,
): Promise<AssignmentWithDetails> {
  const assignment = await getAssignmentById(assignmentId);
  await refreshAssignmentMessage(client, assignment);
  return assignment;
}
