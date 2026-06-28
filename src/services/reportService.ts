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

export function getReportRows(): ReportRow[] {
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
      user: row.user_id,
      completionStatus: row.status,
    }));
  });
}

export function generateCsvReport(): string {
  const rows = getReportRows();
  const header = 'date,task assigned,user,completion status';
  const lines = rows.map(
    (row) =>
      [
        escapeCsvField(row.date),
        escapeCsvField(row.taskAssigned),
        escapeCsvField(row.user),
        escapeCsvField(row.completionStatus),
      ].join(','),
  );

  return [header, ...lines].join('\n');
}
