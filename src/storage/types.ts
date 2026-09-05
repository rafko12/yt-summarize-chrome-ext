export interface StorageAdapter {
  read(keys: readonly string[]): Promise<Record<string, unknown>>;
  write(values: Record<string, unknown>): Promise<void>;
}

export type StoragePlatform = StorageAdapter;
