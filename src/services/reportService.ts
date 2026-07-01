import type { Client } from 'discord.js';
import { getDatabase } from '../db';
import { wrapDatabaseError } from '../utils/errors';
import type { AssignmentStatus, ReportRow } from '../types';

interface AssignmentReportRow {
  week_date: string;
  task_title: string;
  user_id: string;
  status: AssignmentStatus;
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function resolveUsername(
  client: Client,
  userId: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(userId);
  if (cached) {
    return cached;
  }

  const cachedUser = client.users.cache.get(userId);
  if (cachedUser) {
    const name = cachedUser.username;
    cache.set(userId, name);
    return name;
  }

  try {
    const user = await client.users.fetch(userId);
    const name = user.username;
    cache.set(userId, name);
    return name;
  } catch {
    cache.set(userId, 'Unknown User');
    return 'Unknown User';
  }
}

export function getReportRows(): Omit<ReportRow, 'username'>[] {
  return wrapDatabaseError(() => {
    const db = getDatabase();
    const rows = db
      .prepare(
        `
        SELECT
          a.week_date,
          t.title AS task_title,
          a.user_id,
          a.status
        FROM assignments a
        INNER JOIN tasks t ON t.id = a.task_id
        ORDER BY a.week_date ASC, a.id ASC
      `,
      )
      .all() as unknown as AssignmentReportRow[];

    return rows.map((row) => ({
      date: row.week_date,
      taskAssigned: row.task_title,
      userId: row.user_id,
      completionStatus: row.status,
    }));
  });
}

export async function getReportRowsWithUsernames(client: Client): Promise<ReportRow[]> {
  const rows = getReportRows();
  const usernameCache = new Map<string, string>();

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      username: await resolveUsername(client, row.userId, usernameCache),
    })),
  );
}

export async function generateCsvReport(client: Client): Promise<string> {
  const rows = await getReportRowsWithUsernames(client);
  const header = 'date,task assigned,user id,username,completion status';
  const lines = rows.map(
    (row) =>
      [
        escapeCsvField(row.date),
        escapeCsvField(row.taskAssigned),
        escapeCsvField(row.userId),
        escapeCsvField(row.username),
        escapeCsvField(row.completionStatus),
      ].join(','),
  );

  return [header, ...lines].join('\n');
}
