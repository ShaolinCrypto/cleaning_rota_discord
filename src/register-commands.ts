import { loadConfig } from './config';
import { registerSlashCommands } from './commands/definitions';

async function main(): Promise<void> {
  const config = loadConfig();
  await registerSlashCommands(config);
}

main().catch((error) => {
  console.error('Failed to register commands:', error);
  process.exit(1);
});
