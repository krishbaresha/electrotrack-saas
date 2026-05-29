import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // manifest lives in public/manifest.json — do not duplicate here
      manifest: false,
      includeAssets: ['favicon.ico', 'favicon.svg', 'favicon.png', 'apple-touch-icon.png', 'robots.txt', 'sitemap.xml'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        runtimeCaching: [
          {
            // Match API server at any host (dev or production) — avoid hardcoding localhost
            urlPattern: ({ url }) => url.origin !== self.location.origin,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', networkTimeoutSeconds: 10 },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['recharts', 'lucide-react'],
          'vendor-data': ['zustand', 'axios', 'socket.io-client', 'dexie'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
  },
});
