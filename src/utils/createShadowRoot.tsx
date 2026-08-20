import createGeistFontStyles from '@assets/geistFonts';
import { createRoot } from 'react-dom/client';

/**
 * Creates a shadow root with the specified styles and returns a React root in it.
 * @param {string} styles - CSS styles to be applied to the shadow root.
 * @returns {ReactRoot} - React root rendered inside the shadow root.
 */
export default function createShadowRoot(styles: string) {
  const stylesWithFonts = `${createGeistFontStyles((url) =>
    url.startsWith('/') ? chrome.runtime.getURL(url.slice(1)) : url
  )}\n${styles}`;
  const host = document.createElement('div');

  // Full-screen layout is required for the popup/side-panel UI.
  // pointer-events: none on the host ensures it doesn't block clicks
  // on the underlying page when used as a content script overlay.
  host.style.display = 'block';
  host.style.position = 'fixed';
  host.style.inset = '0';
  host.style.width = '100%';
  host.style.height = '100dvh';
  host.style.pointerEvents = 'none';

  const shadow = host.attachShadow({ mode: 'open' });

  // Create an internal mount node to avoid Xray wrapper issues in Firefox.
  // pointer-events: auto re-enables interaction for visible UI (popup).
  const mount = document.createElement('div');
  if (window.location.protocol.startsWith('chrome-extension')) {
    mount.style.pointerEvents = 'auto';
  } else {
    mount.style.pointerEvents = 'none';
  }
  mount.style.display = 'flex';
  mount.style.flexDirection = 'column';
  mount.style.width = '100%';
  mount.style.height = '100dvh';
  mount.style.minHeight = '0';
  mount.style.overflow = 'hidden';
  mount.style.position = 'relative';
  shadow.appendChild(mount);

  // Apply styles: prefer constructable stylesheets, fallback safely
  try {
    const supportsConstructable =
      'adoptedStyleSheets' in shadow &&
      'replaceSync' in
        (CSSStyleSheet.prototype as unknown as { replaceSync?: unknown });
    if (supportsConstructable) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(stylesWithFonts);
      shadow.adoptedStyleSheets = [sheet];
    } else {
      const styleEl = document.createElement('style');
      styleEl.textContent = stylesWithFonts;
      shadow.appendChild(styleEl);
    }
  } catch {
    const styleEl = document.createElement('style');
    styleEl.textContent = stylesWithFonts;
    shadow.appendChild(styleEl);
  }

  document.body.appendChild(host);
  return createRoot(mount);
}
