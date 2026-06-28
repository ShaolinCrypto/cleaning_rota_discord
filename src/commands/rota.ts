import type { ChatInputCommandInteraction } from 'discord.js';
import { addRotaUser, listRotaUsers, removeRotaUser } from '../services/rotaService';
import { requireAdmin } from '../utils/permissions';

export async function handleRotaCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await requireAdmin(interaction);

  const subcommand = interaction.options.getSubcommand(true);

  switch (subcommand) {
    case 'add': {
      const user = interaction.options.getUser('user', true);
      addRotaUser(user.id);
      await interaction.reply({
        content: `Added ${user} to the cleaning rota.`,
        ephemeral: true,
      });
      break;
    }
    case 'remove': {
      const user = interaction.options.getUser('user', true);
      removeRotaUser(user.id);
      await interaction.reply({
        content: `Removed ${user} from the cleaning rota.`,
        ephemeral: true,
      });
      break;
    }
    case 'list': {
      const users = listRotaUsers();
      if (users.length === 0) {
        await interaction.reply({ content: 'No users on the rota.', ephemeral: true });
        return;
      }

      const lines = users.map((entry, index) => `${index + 1}. <@${entry.userId}> (\`${entry.userId}\`)`);
      await interaction.reply({
        content: `**Rota Users**\n${lines.join('\n')}`,
        ephemeral: true,
      });
      break;
    }
    default:
      await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
}
