export interface ClearUserDataDependencies {
  settings?: { clearApiKeys(): Promise<void> };
  preferences?: { clearApiKeys(): Promise<void> };
  history: { clearRecords(): Promise<void> };
}

/**
 * Orchestrates clearing sensitive user data (all API keys and analysis history)
 * explicitly through their respective functional owners, while preserving remaining
 * settings, theme, and pin state.
 */
export async function clearUserData({
  settings,
  preferences,
  history,
}: ClearUserDataDependencies): Promise<void> {
  const settingsOwner = settings ?? preferences;
  if (settingsOwner) {
    await settingsOwner.clearApiKeys();
  }
  await history.clearRecords();
}
