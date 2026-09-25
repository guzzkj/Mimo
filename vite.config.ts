import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// BASE_PATH: no GitHub Pages o site fica em /Mimo/ (definido no workflow de deploy).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
})
