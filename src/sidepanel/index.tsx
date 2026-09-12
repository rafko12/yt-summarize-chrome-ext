import '@assets/styles/index.css';

import { loadGeistFonts } from '@assets/geistFonts';
import { createRoot, Root } from 'react-dom/client';

import {
  createSidePanelDependencies,
  SidePanelDependencies,
} from './dependencies';
import SidePanelApp from './SidePanelApp';

export const SIDEPANEL_CONTAINER_ID = 'my-ext-sidepanel-page';

export function mountSidePanel(
  targetDoc?: Document,
  customDeps?: SidePanelDependencies
): Root {
  const doc = targetDoc ?? document;
  loadGeistFonts(doc);

  const container = doc.getElementById(SIDEPANEL_CONTAINER_ID);
  if (!container) {
    throw new Error(
      `Nie znaleziono kontenera #${SIDEPANEL_CONTAINER_ID} w dokumencie panelu.`
    );
  }

  const root = createRoot(container);
  root.render(
    <SidePanelApp dependencies={customDeps ?? createSidePanelDependencies()} />
  );
  return root;
}

if (typeof document !== 'undefined') {
  const defaultContainer = document.getElementById(SIDEPANEL_CONTAINER_ID);
  if (defaultContainer) {
    mountSidePanel(document);
  }
}
