import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// SITE_URL = dominio donde se publica (ej: https://pedidos.progas.com.ar/). Las vistas previas
// de WhatsApp necesitan la URL absoluta de la imagen. Se define en .env.production.
export default defineConfig(({ mode }) => {
  const site = (loadEnv(mode, process.cwd(), '').SITE_URL || '').replace(/\/?$/, '/');
  return {
    base: './',
    plugins: [react(), { name: 'site-url', transformIndexHtml: h => h.replaceAll('__SITE__', site === '/' ? '' : site) }],
    build: { target: 'es2019', chunkSizeWarningLimit: 300 },
  };
});
