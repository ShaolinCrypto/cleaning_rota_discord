import dotenv from 'dotenv';
import type { AppConfig } from './types';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function loadConfig(): AppConfig {
  return {
    discordToken: requireEnv('DISCORD_TOKEN'),
    clientId: requireEnv('CLIENT_ID'),
    guildId: requireEnv('GUILD_ID'),
    assignmentChannelId: requireEnv('ASSIGNMENT_CHANNEL_ID'),
    databasePath: process.env.DATABASE_PATH ?? './data/rota.db',
    premisesId: optionalEnv('PREMISES_ID'),
    uprn: optionalEnv('UPRN'),
  };
}

/** Returns PREMISES_ID if set, otherwise UPRN. */
export function getPremisesId(config: AppConfig): string | undefined {
  return config.premisesId || config.uprn;
}

/**
 * Weekly assignment schedule.
 *
 * Change `WEEKLY_ASSIGNMENT_CRON` to adjust when assignments are posted.
 * Uses standard cron syntax (minute hour day-of-month month day-of-week).
 *
 * Default: every Monday at 09:00 (server local time).
 * Examples:
 *   '0 9 * * 1'  - Monday 09:00
 *   '0 8 * * 0'  - Sunday 08:00
 *   '30 17 * * 5' - Friday 17:30
 */
export const WEEKLY_ASSIGNMENT_CRON = '0 9 * * 1';

export const TIMEZONE = 'Europe/London';
