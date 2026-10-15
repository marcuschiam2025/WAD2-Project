import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

const frontendDir = fileURLToPath(new URL('.', import.meta.url))
const backendDir = fileURLToPath(new URL('../backend', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Router, stores, services, data and utils live in ../backend
      '@backend': backendDir,
    },
    // Files in ../backend import these; always resolve them from frontend/node_modules
    dedupe: ['vue', 'vue-router', 'pinia'],
  },
  server: {
    fs: {
      // Let the dev server read files outside frontend/
      allow: [frontendDir, backendDir],
    },
    // Forward API calls to the Express backend during development
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
