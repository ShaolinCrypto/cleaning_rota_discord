import type { Client } from 'discord.js';
import { startWeeklyScheduler } from '../services/schedulerService';

export function registerReadyEvent(client: Client, assignmentChannelId: string): void {
  client.once('ready', () => {
    console.log(`Logged in as ${client.user?.tag}`);
    startWeeklyScheduler(client, assignmentChannelId);
  });
}
