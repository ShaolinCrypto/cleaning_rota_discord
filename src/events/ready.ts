import { Events, type Client } from 'discord.js';
import { startWeeklyScheduler } from '../services/schedulerService';

export function registerReadyEvent(client: Client, rotaChannelId: string): void {
  client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user?.tag}`);
    startWeeklyScheduler(client, rotaChannelId);
  });
}
