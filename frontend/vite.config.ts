import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/predict': 'http://127.0.0.1:8000',
      '/history': 'http://127.0.0.1:8000',
      '/model': 'http://127.0.0.1:8000',
      '/models': 'http://127.0.0.1:8000',
      '/dataset': 'http://127.0.0.1:8000',
      '/vocabulary': 'http://127.0.0.1:8000',
      '/translate': 'http://127.0.0.1:8000',
      '/gesture': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
      '/api': 'http://127.0.0.1:8000',
    }
  }
})
