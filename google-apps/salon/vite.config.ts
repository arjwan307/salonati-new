import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'serve-salonati-routes',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (!req.url) return next();
            const cleanUrl = req.url.split('?')[0];

            if (cleanUrl === '/__salonati_ads.js') {
              const filePath = path.resolve(__dirname, 'public/__salonati_ads.js');
              if (fs.existsSync(filePath)) {
                res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                res.end(fs.readFileSync(filePath));
                return;
              }
            }

            if (
              cleanUrl === '/cosmetics/owner' ||
              cleanUrl === '/cosmetics/owner/' ||
              cleanUrl === '/cosmetics' ||
              cleanUrl === '/cosmetics/' ||
              cleanUrl === '/apps/cosmetics/owner' ||
              cleanUrl === '/apps/cosmetics/owner/'
            ) {
              const htmlPath = path.resolve(__dirname, 'cosmetics/owner/index.html');
              if (fs.existsSync(htmlPath)) {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(fs.readFileSync(htmlPath));
                return;
              }
            }

            if (
              cleanUrl === '/owner' ||
              cleanUrl === '/owner/' ||
              cleanUrl === '/apps/owner' ||
              cleanUrl === '/apps/owner/'
            ) {
              const ownerPath = path.resolve(__dirname, 'owner/index.html');
              if (fs.existsSync(ownerPath)) {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(fs.readFileSync(ownerPath));
                return;
              }
            }

            if (cleanUrl === '/customer' || cleanUrl === '/customer/' || cleanUrl === '/apps/customer' || cleanUrl === '/apps/customer/') {
              const customerPath = path.resolve(__dirname, 'apps/customer/index.html');
              if (fs.existsSync(customerPath)) {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(fs.readFileSync(customerPath));
                return;
              }
            }

            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          'owner-standalone': path.resolve(__dirname, 'owner/index.html'),
          'cosmetics-owner-standalone': path.resolve(__dirname, 'cosmetics/owner/index.html'),
          'apps-customer': path.resolve(__dirname, 'apps/customer/index.html'),
          'apps-owner': path.resolve(__dirname, 'apps/owner/index.html'),
          'apps-admin': path.resolve(__dirname, 'apps/admin/index.html'),
          'cosmetics-customer': path.resolve(__dirname, 'apps/cosmetics/customer/index.html'),
          'cosmetics-owner': path.resolve(__dirname, 'apps/cosmetics/owner/index.html'),
          'cosmetics-admin': path.resolve(__dirname, 'apps/cosmetics/admin/index.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
