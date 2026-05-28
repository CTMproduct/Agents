import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.railway.app',
    ],
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // Proxy all /api/* calls to backend
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
  preview: {
    allowedHosts: [
      '.railway.app',
    ],
    host: '0.0.0.0',
    port: 5173
  }
})

