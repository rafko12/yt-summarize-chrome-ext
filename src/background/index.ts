import { STORAGE_KEYS } from '../utils/storage';
import createChromeSidePanelAdapter from './chromeSidePanelAdapter';
import {
  installSidePanelController,
  SidePanelFailure,
} from './sidePanelController';
import registerYoutubeNavigationEvents from './youtubeNavigationEvents';

const PANEL_PATH = 'src/sidepanel/index.html';
const LOCAL_OPEN_TABS_KEY = 'local_open_panel_tab_ids';

const PINNED_WINDOW_KEY = 'pinned_panel_window_id';
function reportSidePanelFailure({ message, cause }: SidePanelFailure): void {
  // eslint-disable-next-line no-console
  console.error(message, cause);
}

installSidePanelController({
  platform: createChromeSidePanelAdapter(chrome, {
    panelPath: PANEL_PATH,
    localOpenTabsKey: LOCAL_OPEN_TABS_KEY,
    pinStateKey: STORAGE_KEYS.PANEL_PIN_STATE,
    pinnedWindowKey: PINNED_WINDOW_KEY,
  }),
  reportError: reportSidePanelFailure,
});

registerYoutubeNavigationEvents(chrome);
