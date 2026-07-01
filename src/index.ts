import { Client, GatewayIntentBits } from 'discord.js';
import { loadConfig } from './config';
import { registerSlashCommands } from './commands/definitions';
import { initDatabase, closeDatabase, logDatabaseStats } from './db';
import { registerReadyEvent } from './events/ready';
import { registerInteractionCreateEvent } from './events/interactionCreate';

async function main(): Promise<void> {
  const config = loadConfig();

  await registerSlashCommands(config);

  await initDatabase(config);
  await logDatabaseStats();

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  registerReadyEvent(client, config.rotaChannelId);
  registerInteractionCreateEvent(client);

  const shutdown = async (): Promise<void> => {
    console.log('Shutting down...');
    await closeDatabase();
    client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });

  await client.login(config.discordToken);
}

main().catch((error) => {
  console.error('Fatal error starting bot:', error);
  process.exit(1);
});
