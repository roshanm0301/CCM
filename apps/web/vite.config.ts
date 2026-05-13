import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// Enable HTTPS on the dev server so that secure-context-only browser APIs
// (getUserMedia, WebRTC) work when accessing via LAN IP addresses.
// Set VITE_HTTPS=true in .env or docker-compose to activate.
const useHttps = process.env['VITE_HTTPS'] === 'true';

// https://vitejs.dev/config/
// Async config: dynamically imports @vitejs/plugin-basic-ssl only when
// VITE_HTTPS=true so the dev server does not crash if the package is
// missing from node_modules (e.g. stale Docker volume).
export default defineConfig(async () => {
  const plugins: PluginOption[] = [react()];

  if (useHttps) {
    const basicSsl = (await import('@vitejs/plugin-basic-ssl')).default;
    plugins.push(basicSsl());
  }

  plugins.push(
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'CCM — Customer Contact Management',
        short_name: 'CCM',
        description: 'Customer Contact Management agent workspace',
        theme_color: '#1565C0',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'en',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache the app shell (HTML, JS, CSS, fonts, images) for offline access
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // API calls — NetworkOnly: never cache API responses
            // Security requirement: session data must not be cached in SW
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
          {
            // Fonts from Google CDN — cache for offline use
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            // Font files — cache with long TTL
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
      devOptions: {
        // Disable PWA in development to avoid SW interference with HMR
        enabled: false,
      },
    }),
  );

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@ccm/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      },
    },
    server: {
      port: 5173,
      // Enable SPA history-API fallback so direct URL navigation (F5 / address bar)
      // does not return 404 — Vite serves index.html and React Router handles routing.
      historyApiFallback: true,
      // Polling is required for HMR to work inside Docker on Windows because
      // inotify filesystem events from the Windows host are not forwarded into
      // the Linux container via bind mounts.
      watch: {
        usePolling: true,
        interval: 300,
      },
      proxy: {
        // Proxy API calls to the backend during local Vite dev server usage.
        // API_PROXY_TARGET is a server-side-only env var (no VITE_ prefix) so it
        // is never baked into the browser bundle. Falls back to localhost for
        // plain `npm run dev` outside Docker.
        '/api': {
          target: process.env['API_PROXY_TARGET'] ?? process.env['VITE_API_BASE_URL'] ?? 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: process.env['NODE_ENV'] !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor bundles for better caching
            react: ['react', 'react-dom'],
            mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
            router: ['react-router-dom'],
            query: ['@tanstack/react-query'],
            zustand: ['zustand'],
          },
        },
      },
    },
  };
});
