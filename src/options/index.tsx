import '@assets/styles/index.css';

import { loadGeistFonts } from '@assets/loadGeistFonts';
import { createRoot, Root } from 'react-dom/client';

import OptionsInfoPage from './OptionsInfoPage';

export const OPTIONS_CONTAINER_ID = 'my-ext-options-page';

export function mountOptions(targetDoc?: Document): Root {
  const doc = targetDoc ?? document;
  loadGeistFonts(doc);

  const container = doc.getElementById(OPTIONS_CONTAINER_ID);
  if (!container) {
    throw new Error(
      `Nie znaleziono kontenera #${OPTIONS_CONTAINER_ID} w dokumencie strony opcji.`
    );
  }

  const root = createRoot(container);
  root.render(<OptionsInfoPage />);
  return root;
}

if (typeof document !== 'undefined') {
  const defaultContainer = document.getElementById(OPTIONS_CONTAINER_ID);
  if (defaultContainer) {
    mountOptions(document);
  }
}
