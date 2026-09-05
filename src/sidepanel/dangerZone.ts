export interface DangerZoneOwners {
  preferences: { clearApiKeys(): Promise<void> };
  history: { clearRecords(): Promise<void> };
}

/**
 * Orchestrates clearing sensitive user data (all API keys and analysis history)
 * explicitly through their respective domain owners, while preserving remaining
 * preferences, settings, and pin state.
 */
export async function clearApiKeysAndHistory({
  preferences,
  history,
}: DangerZoneOwners): Promise<void> {
  await preferences.clearApiKeys();
  await history.clearRecords();
}
