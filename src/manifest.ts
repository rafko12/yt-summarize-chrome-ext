import { defineManifest } from '@crxjs/vite-plugin';

import packageData from '../package.json';

const isDev = process.env.NODE_ENV === 'development';

export default defineManifest({
  manifest_version: 3,
  minimum_chrome_version: '142',
  name: `${packageData.displayName || packageData.name}${
    isDev ? ` ➡️ Dev` : ''
  }`,
  version: packageData.version,
  description: packageData.description,
  action: {
    default_icon: {
      16: 'icon16.png',
      32: 'icon32.png',
      48: 'icon48.png',
      128: 'icon128.png',
    },
  },
  icons: {
    16: 'icon16.png',
    32: 'icon32.png',
    48: 'icon48.png',
    128: 'icon128.png',
  },
  permissions: ['tabs', 'storage', 'sidePanel', 'scripting'],
  host_permissions: [
    'https://*.youtube.com/*',
    'https://api.openai.com/*',
    'https://api.anthropic.com/*',
    'https://generativelanguage.googleapis.com/*',
  ],
  side_panel: {
    default_path: 'src/popup/index.html',
  },
  content_scripts: [
    {
      js: isDev
        ? ['src/content/index.dev.tsx']
        : ['src/content/index.prod.tsx'],
      matches: ['https://*.youtube.com/*'],
    },
  ],
  web_accessible_resources: [
    {
      resources: ['*.js', '*.css', 'public/*', 'assets/fonts/*'],
      matches: ['<all_urls>'],
    },
  ],
});
