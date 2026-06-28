import { AttachmentBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { generateCsvReport } from '../services/reportService';
import { requireAdmin } from '../utils/permissions';

export async function handleReportCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await requireAdmin(interaction);

  const csv = generateCsvReport();
  const attachment = new AttachmentBuilder(Buffer.from(csv, 'utf-8'), {
    name: `cleaning-rota-report-${new Date().toISOString().slice(0, 10)}.csv`,
  });

  await interaction.editReply({
    content: 'Assignment report generated.',
    files: [attachment],
  });
}
