import createAnalysisHistory from './analysisHistory';
import createChromeAnalysisHistoryAdapter, {
  createChromeAnalysisHistoryPlatform,
} from './chromeAnalysisHistoryAdapter';

export * from './types';
export { default as HistoryView } from './HistoryView';
export { default as useHistory } from './useHistory';
export {
  createAnalysisHistory,
  createChromeAnalysisHistoryAdapter,
  createChromeAnalysisHistoryPlatform,
};
export default createAnalysisHistory;
