import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  const devPort = (() => {
    const raw = env.VITE_PORT || '';
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 3000;
  })();

  return {
    server: {
      port: devPort,
      host: '0.0.0.0',
      fs: {
        allow: [path.resolve(__dirname, '..')]
      },
      proxy: {
        '/local-api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/local-api/, ''),
        },
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || '')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
