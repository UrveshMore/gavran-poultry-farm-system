import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const env = loadEnv(mode, root, '');
  const clientPort = Number(env.CLIENT_PORT || 5317);
  const apiPort = Number(env.PORT || 5318);
  return {
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: 'Gavran Poultry',
        short_name: 'Gavran',
        description: 'Farm records for Gavran and desi poultry',
        theme_color: '#2f6b3a',
        background_color: '#f4e9c9',
        display: 'standalone',
        start_url: '/',
        lang: 'en',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@gavran/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: clientPort,
    strictPort: true,
    proxy: {
      '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: clientPort,
    strictPort: true,
    proxy: {
      '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true },
    },
  },
};
});
