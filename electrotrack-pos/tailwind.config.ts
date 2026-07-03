import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        // Stitch UI Design System Colors
        stitch: {
          surface: '#0e1322',
          'surface-dim': '#0e1322',
          'surface-bright': '#343949',
          'surface-container-lowest': '#090e1c',
          'surface-container-low': '#161b2b',
          'surface-container': '#1a1f2f',
          'surface-container-high': '#25293a',
          'surface-container-highest': '#2f3445',
          'on-surface': '#dee1f7',
          'on-surface-variant': '#c7c4d7',
          'inverse-surface': '#dee1f7',
          'inverse-on-surface': '#2b3040',
          outline: '#908fa0',
          'outline-variant': '#464554',
          'surface-tint': '#c0c1ff',
          primary: '#c0c1ff',
          'on-primary': '#1000a9',
          'primary-container': '#8083ff',
          'on-primary-container': '#0d0096',
          'inverse-primary': '#494bd6',
          secondary: '#d0bcff',
          'on-secondary': '#3c0091',
          'secondary-container': '#571bc1',
          'on-secondary-container': '#c4abff',
          tertiary: '#2fd9f4',
          'on-tertiary': '#00363e',
          'tertiary-container': '#008395',
          'on-tertiary-container': '#000608',
          error: '#ffb4ab',
          'on-error': '#690005',
          'error-container': '#93000a',
          'on-error-container': '#ffdad6',
          background: '#0e1322',
          'on-background': '#dee1f7',
          'surface-variant': '#2f3445',
        }
      },
      fontFamily: {
        space: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
