import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: {
    // Shown in the profile so you can tell which version a phone is running.
    __BUILD__: JSON.stringify(new Date().toLocaleString('en-GB', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PinGü',
        short_name: 'PinGü',
        description: 'Find your crew at the festival, even with bad signal.',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3_000_000,
        // App shell, icon fonts and the venue map all load with zero signal.
        globPatterns: ['**/*.{js,css,html,woff2,webp,png}'],
        navigateFallback: '/index.html',
        importScripts: ['/push-sw.js'], // notification handling (public/push-sw.js)
        runtimeCaching: [
          {
            // Crew photos: once seen, keep them.
            urlPattern: /\/storage\/v1\/object\/public\/photos\//,
            handler: 'CacheFirst',
            options: { cacheName: 'crew-photos', expiration: { maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
})
