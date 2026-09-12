import autoprefixer from 'autoprefixer';

import tailwindcss from '@tailwindcss/postcss';

/**
 * Configuration object for PostCSS plugins.
 * @type {Object}
 * @property {Function[]} plugins - Array of PostCSS plugins.
 */
const postcssConfig = {
  plugins: [
    // Apply Tailwind CSS
    tailwindcss(),

    // Add vendor prefixes
    autoprefixer(),
  ],
};

export default postcssConfig;
