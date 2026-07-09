import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El frontend se sirve bajo /app desde la misma API (un solo servicio en Railway).
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      ['/auth', '/marketplace', '/automations', '/review', '/learning', '/metrics', '/admin', '/health', '/security', '/arena'].map((p) => [
        p,
        { target: 'http://localhost:3000', changeOrigin: true },
      ]),
    ),
  },
});
