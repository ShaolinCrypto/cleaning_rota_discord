import { EmbedBuilder } from 'discord.js';
import type { BinCollection } from '../types/bins';

export const BIN_EMBED_COLOR = 0x232428;

const LONDON_TIMEZONE = 'Europe/London';

export function formatDateShort(value: string): string {
  const date = new Date(value);
  const weekday = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    timeZone: LONDON_TIMEZONE,
  }).format(date);
  const day = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    timeZone: LONDON_TIMEZONE,
  }).format(date);
  const month = new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    timeZone: LONDON_TIMEZONE,
  }).format(date);

  return `${weekday}, ${day} ${month}`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  const weekday = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    timeZone: LONDON_TIMEZONE,
  }).format(date);
  const rest = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: LONDON_TIMEZONE,
  }).format(date);

  return `${weekday}, ${rest}`;
}

export function binEmoji(type: string): string {
  const t = type.toLowerCase();

  if (t.includes('black')) return '<:black_bin:1520236253906472990>';
  if (t.includes('brown')) return '<:brown_bin:1520236296646164620>';
  if (t.includes('green')) return '<:green_bin:1520236335510585446>';

  return '🗑️';
}

export function binTypeLabel(type: string): string {
  const t = type.toLowerCase();

  if (t.includes('black') || t.includes('general')) return 'BLACK';
  if (t.includes('brown')) return 'BROWN';
  if (t.includes('green') || t.includes('garden')) return 'GREEN';
  if (t.includes('recycl')) return 'RECYCLING';

  return type.toUpperCase();
}

function formatNextCollection(item: BinCollection): string {
  return `Next collection: ${binEmoji(item.type)} **${binTypeLabel(item.type)}** on **${formatDate(item.date)}**`;
}

function formatCollectionFields(collections: BinCollection[]) {
  return [
    {
      name: 'Bin',
      value: collections.map((item) => binEmoji(item.type)).join('\n'),
      inline: true,
    },
    {
      name: 'Collection',
      value: collections.map((item) => formatDateShort(item.date)).join('\n'),
      inline: true,
    },
  ];
}

export function buildBinsEmbed(collections: BinCollection[]): EmbedBuilder {
  if (collections.length === 0) {
    return new EmbedBuilder()
      .setTitle('🗓️ Upcoming bin collections')
      .setDescription('No upcoming collections found.')
      .setColor(BIN_EMBED_COLOR);
  }

  const next = collections[0];
  const upcoming = collections.slice(0, 8);

  return new EmbedBuilder()
    .setTitle('🗓️ Upcoming bin collections')
    .setDescription(formatNextCollection(next))
    .addFields(formatCollectionFields(upcoming))
    .setColor(BIN_EMBED_COLOR)
    .setFooter({ text: 'Leeds City Council (via bins.felixyeung.com)' })
    .setTimestamp(new Date());
}
