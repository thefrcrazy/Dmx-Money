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
      // Catalina (Safari 13) support requires more aggressive transpilation
      targets: ['safari >= 13', 'ios >= 13', 'chrome >= 71', 'edge >= 79', 'firefox >= 67', 'not IE 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      polyfills: [
        'es.promise.finally', 
        'es.array.flat-map', 
        'es.array.flat', 
        'es.object.from-entries',
        'es.symbol.description'
      ],
      modernPolyfills: true // Include polyfills for modern browsers too to be safe
    })
  ],
  build: {
    // Explicitly target ES2015 for maximum compatibility on older systems
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      safari10: true, // Fixes specific Safari bugs
    },
    // Ensure that build.cssTarget matches our compatibility goals
    cssTarget: 'safari13'
  }
})
