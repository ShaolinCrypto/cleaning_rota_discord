import type { Client, TextChannel } from 'discord.js';
import { getDatabase } from '../db';
import { getActiveTasks } from './taskService';
import { getRotationIndex, listRotaUsers } from './rotaService';
import { buildAssignmentButtons, buildAssignmentEmbed } from '../utils/embeds';
import {
  BotError,
  DatabaseError,
  ValidationError,
  wrapDatabaseError,
  NotFoundError,
} from '../utils/errors';
import type {
  Assignment,
  AssignmentStatus,
  AssignmentWithDetails,
  WeeklyAssignmentResult,
} from '../types';

interface AssignmentRow {
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

export function getAssignmentById(assignmentId: number): AssignmentWithDetails {
  return wrapDatabaseError(() => {
    const db = getDatabase();
    const row = db
      .prepare(
        `
        SELECT a.*, t.title AS task_title, t.description AS task_description
        FROM assignments a
        INNER JOIN tasks t ON t.id = a.task_id
        WHERE a.id = ?
      `,
      )
      .get(assignmentId) as AssignmentWithDetailsRow | undefined;

    if (!row) {
      throw new NotFoundError('Assignment', assignmentId);
    }

    return mapAssignmentWithDetails(row);
  });
}

export function hasAssignmentsForWeek(weekDate: string): boolean {
  return wrapDatabaseError(() => {
    const db = getDatabase();
    const row = db
      .prepare('SELECT COUNT(*) AS count FROM assignments WHERE week_date = ?')
      .get(weekDate) as { count: number };
    return row.count > 0;
  });
}

export function createWeeklyAssignments(weekDate: string = getWeekDate()): WeeklyAssignmentResult {
  return wrapDatabaseError(() => {
    const db = getDatabase();
    const users = listRotaUsers();
    const tasks = getActiveTasks();
    const warnings: string[] = [];

    if (users.length === 0) {
      throw new ValidationError('Cannot create assignments: no users on the rota.');
    }

    if (tasks.length === 0) {
      throw new ValidationError('Cannot create assignments: no active tasks.');
    }

    if (hasAssignmentsForWeek(weekDate)) {
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

    let rotationIndex = getRotationIndex();
    const createdAt = new Date().toISOString();
    const insert = db.prepare(`
      INSERT INTO assignments (week_date, task_id, user_id, status, created_at)
      VALUES (?, ?, ?, 'Assigned', ?)
    `);

    const createdIds: number[] = [];

    db.exec('BEGIN IMMEDIATE');
    try {
      for (let slot = 0; slot < assignmentCount; slot += 1) {
        const user = users[(rotationIndex + slot) % users.length];
        const task = tasks[(rotationIndex + slot) % tasks.length];

        const result = insert.run(weekDate, task.id, user.userId, createdAt);
        createdIds.push(Number(result.lastInsertRowid));
      }

      db.prepare('UPDATE rota_state SET rotation_index = ? WHERE id = 1').run(
        (rotationIndex + assignmentCount) % users.length,
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    const assignments = createdIds.map((id) => getAssignmentById(id));
    return { assignments, warnings };
  });
}

export function updateAssignmentStatus(
  assignmentId: number,
  status: AssignmentStatus,
): AssignmentWithDetails {
  return wrapDatabaseError(() => {
    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM assignments WHERE id = ?').get(assignmentId);
    if (!existing) {
      throw new NotFoundError('Assignment', assignmentId);
    }

    db.prepare('UPDATE assignments SET status = ? WHERE id = ?').run(status, assignmentId);
    return getAssignmentById(assignmentId);
  });
}

export function setAssignmentMessage(
  assignmentId: number,
  messageId: string,
  channelId: string,
): void {
  wrapDatabaseError(() => {
    const db = getDatabase();
    db.prepare('UPDATE assignments SET message_id = ?, channel_id = ? WHERE id = ?').run(
      messageId,
      channelId,
      assignmentId,
    );
  });
}

export function getAssignmentsForWeek(weekDate: string): AssignmentWithDetails[] {
  return wrapDatabaseError(() => {
    const db = getDatabase();
    const rows = db
      .prepare(
        `
        SELECT a.*, t.title AS task_title, t.description AS task_description
        FROM assignments a
        INNER JOIN tasks t ON t.id = a.task_id
        WHERE a.week_date = ?
        ORDER BY a.id ASC
      `,
      )
      .all(weekDate) as unknown as AssignmentWithDetailsRow[];

    return rows.map(mapAssignmentWithDetails);
  });
}

export function deleteAssignmentsForWeek(weekDate: string): number {
  return wrapDatabaseError(() => {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM assignments WHERE week_date = ?').run(weekDate);
    return Number(result.changes);
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
  const existing = getAssignmentsForWeek(weekDate);
  const warnings: string[] = [];

  if (existing.length > 0) {
    warnings.push(`Replaced ${existing.length} existing assignment(s) for week ${weekDate}.`);
    await deleteAssignmentMessages(client, existing);
    deleteAssignmentsForWeek(weekDate);
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
    result = createWeeklyAssignments(weekDate);
  } catch (error) {
    if (error instanceof ValidationError && error.message.includes('already been created')) {
      return {
        assignments: getAssignmentsForWeek(weekDate),
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

      setAssignmentMessage(assignment.id, message.id, channel.id);
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
  const assignment = getAssignmentById(assignmentId);
  await refreshAssignmentMessage(client, assignment);
  return assignment;
}
