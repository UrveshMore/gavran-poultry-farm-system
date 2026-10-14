import basicSsl from '@vitejs/plugin-basic-ssl';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function lanHosts(): string[] {
  const hosts = new Set<string>(['localhost']);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list ?? []) {
      if (item.family === 'IPv4') hosts.add(item.address);
    }
  }
  return [...hosts];
}

export default defineConfig(({ mode }) => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const env = loadEnv(mode, root, '');
  const clientPort = Number(env.CLIENT_PORT || 5317);
  const apiPort = Number(env.PORT || 5318);
  const httpsOn = env.HTTPS === '1';
  const certPath = env.HTTPS_CERT ? path.resolve(root, env.HTTPS_CERT) : '';
  const keyPath = env.HTTPS_KEY ? path.resolve(root, env.HTTPS_KEY) : '';
  const mkcert = httpsOn && certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath);
  const https = mkcert ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) } : undefined;
  const proxy = { '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true } };
  return {
    define: {
      'import.meta.env.VITE_HTTPS': JSON.stringify(httpsOn ? '1' : ''),
    },
    plugins: [
      react(),
      tailwindcss(),
      ...(httpsOn && !mkcert ? [basicSsl({ name: 'gavran', domains: lanHosts() })] : []),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'pwa-192.png', 'pwa-512.png'],
        devOptions: { enabled: httpsOn },
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
      {
        name: 'gavran-phone-hint',
        configureServer(server) {
          server.httpServer?.once('listening', () => {
            const scheme = httpsOn ? 'https' : 'http';
            console.log(`[gavran] This computer: ${scheme}://127.0.0.1:${clientPort}`);
            if (httpsOn) {
              for (const host of lanHosts()) {
                if (host === 'localhost' || host.startsWith('127.')) continue;
                console.log(`[gavran] Phone: ${scheme}://${host}:${clientPort}`);
              }
            }
          });
        },
      },
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
      ...(https ? { https } : {}),
      proxy,
    },
    preview: {
      host: '0.0.0.0',
      port: clientPort,
      strictPort: true,
      ...(https ? { https } : {}),
      proxy,
    },
  };
});
