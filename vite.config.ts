import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import tailwindcss from '@tailwindcss/vite'

import legacy from '@vitejs/plugin-legacy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    legacy({
      targets: ['defaults', 'safari 13'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      polyfills: ['es.promise.finally', 'es/map', 'es/set'],
      modernPolyfills: ['es.promise.finally', 'es.number.to-fixed', 'es.number.to-precision']
    })
  ],
  build: {
    target: ['es2015', 'safari13'],
    minify: 'terser',
  }
})
