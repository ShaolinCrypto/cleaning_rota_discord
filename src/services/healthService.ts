import { checkDatabaseHealth, type DatabaseHealth } from '../db';
import type { AppConfig } from '../types';

export function formatHealthReport(health: DatabaseHealth): string {
  const statusLine = health.ok
    ? '✅ Database connection: OK'
    : '❌ Database connection: FAILED';

  const lines = [
    statusLine,
    '',
    'Engine: MySQL',
    `Host: ${health.host}`,
    `Database: ${health.database}`,
    `User: ${health.user}`,
    '',
    `Ping: ${health.pingMs} ms`,
  ];

  if (health.error) {
    lines.push('', `Error: ${health.error}`);
  }

  if (health.tables.length > 0) {
    lines.push('', 'Tables:');
    for (const table of health.tables) {
      lines.push(`- ${table.name} (${table.rows} rows)`);
    }
  }

  return lines.join('\n');
}

export async function getHealthReport(config: AppConfig): Promise<string> {
  const health = await checkDatabaseHealth(config);
  return formatHealthReport(health);
}
