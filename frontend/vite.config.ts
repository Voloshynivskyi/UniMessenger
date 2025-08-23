// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:7007',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:7007',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:7007',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
