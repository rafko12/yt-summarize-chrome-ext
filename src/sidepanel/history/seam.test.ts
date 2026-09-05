import { describe, expect, it } from 'vitest';

import defaultCreateAnalysisHistory, {
  createAnalysisHistory,
  createChromeAnalysisHistoryAdapter,
  createChromeAnalysisHistoryPlatform,
  HistoryView,
  useHistory,
} from './index';

describe('History Module public seam (src/sidepanel/history)', () => {
  it('exposes createAnalysisHistory factory and default export', () => {
    expect(createAnalysisHistory).toBeDefined();
    expect(typeof createAnalysisHistory).toBe('function');
    expect(defaultCreateAnalysisHistory).toBe(createAnalysisHistory);
  });

  it('exposes Chrome analysis history adapter factory and alias', () => {
    expect(createChromeAnalysisHistoryAdapter).toBeDefined();
    expect(typeof createChromeAnalysisHistoryAdapter).toBe('function');
    expect(createChromeAnalysisHistoryPlatform).toBe(
      createChromeAnalysisHistoryAdapter
    );
  });

  it('exposes useHistory hook', () => {
    expect(useHistory).toBeDefined();
    expect(typeof useHistory).toBe('function');
  });

  it('exposes HistoryView component', () => {
    expect(HistoryView).toBeDefined();
    expect(typeof HistoryView).toBe('function');
  });
});
