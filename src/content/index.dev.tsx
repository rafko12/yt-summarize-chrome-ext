/**
 * Initializes the application with Hot Module Replacement (HMR) support for CSS changes.
 * This module addresses issues with HMR when using inline CSS stylesheets during development.
 * When changes are made to Tailwind CSS or other CSS classes, the dev server typically needs
 * to be stopped and restarted to apply the new styles. This module intercepts CSS changes and
 * applies them dynamically without requiring a full dev server restart, thereby improving
 * development efficiency by providing smoother HMR for CSS changes.
 *
 * @module index.dev
 */

import initializeContentScript from './Content';

initializeContentScript();
