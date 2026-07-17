import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import https from 'https';
import zlib from 'zlib';
import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
const pkg = _require('./package.json');

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().split('T')[0]),
  },
  plugins: [
    s3AudioProxy(),
    svelte({ hot: !process.env.VITEST }),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'favicon-16.png',
        'favicon-32.png',
        'apple-touch-icon.png',
        'apple-touch-icon-152.png',
        'apple-touch-icon-167.png',
        'logo.svg'
      ],
      manifest: {
        id: '/?source=pwa',
        name: 'GobOps — Seguimiento de Requerimientos',
        short_name: 'GobOps',
        description: 'Sistema de gestión de visitas y requerimientos del grupo operativo',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        scope: '/',
        start_url: '/?source=pwa',
        lang: 'es-CO',
        categories: ['productivity', 'business', 'government'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      // NOTE: runtime caching now lives in src/sw.ts (injectManifest mode)
      devOptions: {
        enabled: false,
        type: 'module'
      }
    })
  ],
  // Vitest runs the module graph through Node's default resolution
  // conditions, NOT the "browser" condition — but Svelte's package.json
  // exports map picks a different runtime per condition: with "browser" it
  // resolves to src/runtime/index.js (the real DOM runtime); without it,
  // it silently falls back to src/runtime/ssr.js, where onMount/onDestroy/
  // afterUpdate etc. are no-ops (SSR never "mounts"). Without this, any
  // component test relying on onMount (e.g. a component that loads its
  // data on mount) would silently never fire it, with no error — the
  // component still renders, so the failure mode is a passing-looking test
  // that only catches missing async data loads.
  resolve: {
    conditions: process.env.VITEST ? ['browser'] : undefined,
  },
  server: {
    port: 5173,
    proxy: {
      '/api/auth': {
        target: env.VITE_AUTH_API_TARGET || 'https://web-production-79739.up.railway.app',
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
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'e2e/**/*'],
  }
  };
});
