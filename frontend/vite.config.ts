import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split Three.js and GSAP into their own lazy-loaded chunks
          // so the main app bundle stays small for non-homepage pages.
          "three":  ["three"],
          "gsap":   ["gsap"],
          // React ecosystem
          "vendor": ["react", "react-dom", "react-router-dom"],
          "query":  ["@tanstack/react-query"],
        },
      },
    },
    // Increase warning limit (three.js chunk is expected to be ~600KB)
    chunkSizeWarningLimit: 700,
  },
})
