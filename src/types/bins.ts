export interface BinCollection {
  date: string;
  type: string;
}

export type BinsCommandResult =
  | { kind: 'config_error'; message: string }
  | { kind: 'api_error'; message: string }
  | { kind: 'success'; collections: BinCollection[] };
