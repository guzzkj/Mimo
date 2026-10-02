import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Em dev, /api vai para as Pages Functions rodando no wrangler (`pnpm dev:api`).
// O Origin do navegador continua http://localhost:5173 (APP_URL do wrangler.toml).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:8788', changeOrigin: false },
    },
  },
})
