import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import https from 'https';
import zlib from 'zlib';

function s3AudioProxy() {
  return {
    name: 's3-audio-proxy',
    configureServer(server: any) {
      server.middlewares.use('/s3-audio', (req: any, res: any) => {
        const targetUrl = 'https://catatrack-photos.s3.amazonaws.com' + req.url;
        https.get(targetUrl, (s3Res) => {
          if (s3Res.statusCode !== 200) {
            res.statusCode = s3Res.statusCode || 502;
            res.end('S3 error: ' + s3Res.statusCode);
            return;
          }
          // Buffer entire response so we can send Content-Length
          // (required for <audio> duration detection)
          const chunks: Buffer[] = [];
          let stream: NodeJS.ReadableStream = s3Res;
          if (s3Res.headers['content-encoding'] === 'gzip') {
            stream = s3Res.pipe(zlib.createGunzip());
          }
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => {
            const buffer = Buffer.concat(chunks);
            res.setHeader('Content-Type', 'audio/webm');
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.end(buffer);
          });
          stream.on('error', (err: Error) => {
            res.statusCode = 500;
            res.end('Decompress error: ' + err.message);
          });
        }).on('error', (err) => {
          res.statusCode = 502;
          res.end('Proxy error: ' + err.message);
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [
    s3AudioProxy(),
    svelte({ hot: !process.env.VITEST }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Task Tracker GobOps',
        short_name: 'GobOps',
        description: 'Sistema de gestión de visitas y requerimientos del grupo operativo',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/web-production-79739\.up\.railway\.app\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api/auth': {
        target: 'https://web-production-79739.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/auth/, ''),
        secure: false
      },
      '/api/project': {
        target: 'https://gestorproyectoapi-production.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/project/, ''),
        secure: false
      },
      '/s3-proxy': {
        target: 'https://catatrack-photos.s3.amazonaws.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/s3-proxy/, ''),
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
  }
});
