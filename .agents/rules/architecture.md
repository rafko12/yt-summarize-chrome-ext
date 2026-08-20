---
description: 'Architecture and Technology Stack'
globs: '*'
---

# Architecture and Technology Stack

## Core Technologies

- **Framework:** React 19, TypeScript
- **Build Tool:** Vite with `@crxjs/vite-plugin` for dynamic manifest generation
- **Extension API:** `webextension-polyfill` for cross-browser compatibility (Chrome)
- **Styling:** Tailwind CSS v4, DaisyUI 5, PostCSS
- **Key Libraries:** `youtube-transcript` (for fetching subtitles), Multi-provider AI Integration (Google Gemini, OpenAI, Anthropic Claude)

## Project Structure

- `src/manifest.ts`: Central extension manifest configuration.
- `src/background/`: Service worker scripts handling background tasks.
- `src/content/`: Content scripts injected into web pages (e.g., YouTube).
- `src/popup/`: React application for the extension's popup UI.
- `src/options/`: React application for the extension's options page.
- `src/utils/`: Shared utilities (`storage.ts` for multi-provider API keys and settings, `gemini.ts` for AI calls, `createShadowRoot.tsx`).
- `src/assets/`: Static assets and global styles (`index.css`).

## Architectural Guidelines

- **Manifest:** Always manage manifest settings through `src/manifest.ts`.
- **CSS Themes:** DaisyUI themes must be configured directly in the main CSS file using `@plugin "daisyui"`, not in `tailwind.config.js`.
- **State & Storage:** API keys and settings are persisted via `chrome.storage.local` using functions defined in `src/utils/storage.ts`.
