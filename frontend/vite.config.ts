import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/backend': {
        target: 'http://localhost:8000',
        rewrite: (path) => path.replace(/^\/backend/, ''),
      },
    }
  }
})
