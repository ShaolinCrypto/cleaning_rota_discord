import type { ChatInputCommandInteraction } from 'discord.js';
import { loadConfig } from '../config';
import { buildWeeklyRota, getWeekDate } from '../services/assignmentService';
import { addRotaUser, listRotaUsers, removeRotaUser } from '../services/rotaService';
import { requireAdmin } from '../utils/permissions';

function formatBuildResult(
  weekDate: string,
  rotaChannelId: string,
  assignmentCount: number,
  warnings: string[],
): string {
  const lines = [
    `Built rota for week **${weekDate}**.`,
    `Posted **${assignmentCount}** assignment(s) to <#${rotaChannelId}>.`,
  ];

  if (warnings.length > 0) {
    lines.push('', ...warnings.map((warning) => `- ${warning}`));
  }

  return lines.join('\n');
}

export async function handleRotaCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await requireAdmin(interaction);

  const subcommand = interaction.options.getSubcommand(true);

  switch (subcommand) {
    case 'add': {
      const user = interaction.options.getUser('user', true);
      addRotaUser(user.id);
      await interaction.editReply({
        content: `Added ${user} to the cleaning rota.`,
      });
      break;
    }
    case 'remove': {
      const user = interaction.options.getUser('user', true);
      removeRotaUser(user.id);
      await interaction.editReply({
        content: `Removed ${user} from the cleaning rota.`,
      });
      break;
    }
    case 'build': {
      const config = loadConfig();
      const weekDate = getWeekDate();
      const result = await buildWeeklyRota(interaction.client, config.rotaChannelId, weekDate);
      await interaction.editReply({
        content: formatBuildResult(
          weekDate,
          config.rotaChannelId,
          result.assignments.length,
          result.warnings,
        ),
      });
      break;
    }
    case 'list': {
      const users = listRotaUsers();
      if (users.length === 0) {
        await interaction.editReply({ content: 'No users on the rota.' });
        return;
      }

      const lines = users.map((entry, index) => `${index + 1}. <@${entry.userId}> (\`${entry.userId}\`)`);
      await interaction.editReply({
        content: `**Rota Users**\n${lines.join('\n')}`,
      });
      break;
    }
    default:
      await interaction.editReply({ content: 'Unknown subcommand.' });
  }
}
