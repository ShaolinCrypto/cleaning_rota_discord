import { getPremisesId } from '../config';
import type { AppConfig } from '../types';
import type { BinCollection, BinsCommandResult } from '../types/bins';

const BINS_API_BASE = 'https://bins.felixyeung.com/api/jobs';

function normaliseBinsResponse(raw: unknown): BinCollection[] {
  const record = raw as Record<string, unknown>;
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray((record.data as Record<string, unknown> | undefined)?.jobs)
      ? ((record.data as Record<string, unknown>).jobs as unknown[])
      : Array.isArray(record.data)
        ? (record.data as unknown[])
        : Array.isArray(record.bins)
          ? (record.bins as unknown[])
          : Array.isArray(record.binDays)
            ? (record.binDays as unknown[])
            : [];

  return rows
    .map((entry) => {
      const row = entry as Record<string, unknown>;
      return {
        date:
          (row.date as string | undefined) ||
          (row.collectionDate as string | undefined) ||
          (row.CollectionDate as string | undefined) ||
          (row.binDay as string | undefined) ||
          (row.BinDay as string | undefined) ||
          '',
        type:
          (row.bin as string | undefined) ||
          (row.type as string | undefined) ||
          (row.binType as string | undefined) ||
          (row.BinType as string | undefined) ||
          (row.name as string | undefined) ||
          (row.binName as string | undefined) ||
          (row.BinName as string | undefined) ||
          'Collection',
      };
    })
    .filter((item) => item.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function fetchBinCollections(config: AppConfig): Promise<BinsCommandResult> {
  const premisesId = getPremisesId(config);

  if (!premisesId) {
    return {
      kind: 'config_error',
      message: 'PREMISES_ID (or UPRN) is not configured on the server.',
    };
  }

  const url = `${BINS_API_BASE}?premises=${encodeURIComponent(premisesId)}`;

  console.log('Fetching Leeds bins API for premises', premisesId);

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  } catch (error) {
    console.error('Leeds bins API request failed:', error);
    return {
      kind: 'api_error',
      message: 'Something went wrong fetching bin dates. Please try again.',
    };
  }

  console.log('Leeds bins API status:', response.status);

  if (!response.ok) {
    return {
      kind: 'api_error',
      message: `Leeds bins API returned ${response.status}. Check PREMISES_ID is valid.`,
    };
  }

  try {
    const raw = await response.json();
    const collections = normaliseBinsResponse(raw);
    return { kind: 'success', collections };
  } catch (error) {
    console.error('Leeds bins API parse failed:', error);
    return {
      kind: 'api_error',
      message: 'Something went wrong fetching bin dates. Please try again.',
    };
  }
}
