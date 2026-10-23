import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Crew Finder',
        short_name: 'Crew',
        description: 'Find your friends at the festival, even with bad signal.',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#161826',
        theme_color: '#161826',
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
