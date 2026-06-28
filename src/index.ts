import { Client, GatewayIntentBits } from 'discord.js';
import { loadConfig } from './config';
import { registerSlashCommands } from './commands/definitions';
import { initDatabase, closeDatabase } from './db';
import { registerReadyEvent } from './events/ready';
import { registerInteractionCreateEvent } from './events/interactionCreate';

async function main(): Promise<void> {
  const config = loadConfig();
  initDatabase(config);

  await registerSlashCommands(config);

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  registerReadyEvent(client, config.rotaChannelId);
  registerInteractionCreateEvent(client);

  const shutdown = (): void => {
    console.log('Shutting down...');
    closeDatabase();
    client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await client.login(config.discordToken);
}

main().catch((error) => {
  console.error('Fatal error starting bot:', error);
  process.exit(1);
});
