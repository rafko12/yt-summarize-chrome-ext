import { STORAGE_KEYS } from '../utils/storage';
import createChromeSidePanelPlatform from './chromeSidePanelPlatform';
import {
  installSidePanelController,
  SidePanelFailure,
} from './sidePanelController';
import registerYoutubeUrlUpdates from './youtubeUrlUpdates';

const PANEL_PATH = 'src/popup/index.html';
const LOCAL_OPEN_TABS_KEY = 'local_open_panel_tab_ids';

function reportSidePanelFailure({ message, cause }: SidePanelFailure): void {
  // eslint-disable-next-line no-console
  console.error(message, cause);
}

installSidePanelController({
  platform: createChromeSidePanelPlatform(chrome, {
    panelPath: PANEL_PATH,
    localOpenTabsKey: LOCAL_OPEN_TABS_KEY,
    pinStateKey: STORAGE_KEYS.PANEL_PIN_STATE,
  }),
  reportError: reportSidePanelFailure,
});

registerYoutubeUrlUpdates(chrome);
