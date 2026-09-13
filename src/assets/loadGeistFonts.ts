import geist400 from '@fontsource/geist-sans/files/geist-sans-latin-400-normal.woff2?url';
import geist500 from '@fontsource/geist-sans/files/geist-sans-latin-500-normal.woff2?url';
import geist600 from '@fontsource/geist-sans/files/geist-sans-latin-600-normal.woff2?url';
import geist700 from '@fontsource/geist-sans/files/geist-sans-latin-700-normal.woff2?url';
import geist800 from '@fontsource/geist-sans/files/geist-sans-latin-800-normal.woff2?url';

const fontFaces = [
  [400, geist400],
  [500, geist500],
  [600, geist600],
  [700, geist700],
  [800, geist800],
] as const;

/**
 * Builds font faces directly or with extension URLs so styles do not resolve
 * `/assets` against an external host page if injected externally.
 */
export default function createGeistFontStyles(
  resolveUrl: (url: string) => string = (url) => url
): string {
  return fontFaces
    .map(
      ([weight, url]) => `@font-face {
  font-family: 'Geist Sans';
  font-style: normal;
  font-display: swap;
  font-weight: ${weight};
  src: url('${resolveUrl(url)}') format('woff2');
}`
    )
    .join('\n');
}

/**
 * Loads font declarations directly into the extension document head.
 * Ensures font availability without requiring manual Chrome adapter URL rewriting.
 */
export function loadGeistFonts(doc: Document = document): HTMLStyleElement {
  const existing = doc.querySelector('style[data-font="geist-sans"]');
  if (existing instanceof HTMLStyleElement) {
    return existing;
  }
  const styleEl = doc.createElement('style');
  styleEl.setAttribute('data-font', 'geist-sans');
  styleEl.textContent = createGeistFontStyles();
  doc.head.appendChild(styleEl);
  return styleEl;
}
