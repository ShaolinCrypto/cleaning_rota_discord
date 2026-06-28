import cron from 'node-cron';
import type { Client } from 'discord.js';
import { TIMEZONE, WEEKLY_ASSIGNMENT_CRON } from '../config';
import { postWeeklyAssignments, getWeekDate } from './assignmentService';

export function startWeeklyScheduler(client: Client, rotaChannelId: string): void {
  if (!cron.validate(WEEKLY_ASSIGNMENT_CRON)) {
    throw new Error(`Invalid cron expression: ${WEEKLY_ASSIGNMENT_CRON}`);
  }

  cron.schedule(
    WEEKLY_ASSIGNMENT_CRON,
    async () => {
      const weekDate = getWeekDate();
      console.log(`Running weekly assignment job for week ${weekDate}...`);

      try {
        const result = await postWeeklyAssignments(client, rotaChannelId, weekDate);
        console.log(
          `Posted ${result.assignments.length} assignment(s) for week ${weekDate}.`,
        );
        for (const warning of result.warnings) {
          console.warn(warning);
        }
      } catch (error) {
        console.error('Weekly assignment job failed:', error);
      }
    },
    {
      timezone: TIMEZONE,
    },
  );

  console.log(
    `Weekly scheduler started (${WEEKLY_ASSIGNMENT_CRON}, timezone: ${TIMEZONE}). ` +
      'Edit WEEKLY_ASSIGNMENT_CRON in src/config.ts to change the schedule.',
  );
}
