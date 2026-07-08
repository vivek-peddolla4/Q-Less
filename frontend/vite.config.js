import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // Vite 8 (Rolldown) requires manualChunks as a function
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3') || id.includes('victory')) {
              return 'vendor-recharts';
            }
            if (id.includes('socket.io')) {
              return 'vendor-socket';
            }
            if (id.includes('html5-qrcode') || id.includes('geolib')) {
              return 'vendor-geo';
            }
            if (id.includes('react-toastify') || id.includes('lucide-react') || id.includes('axios')) {
              return 'vendor-ui';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            // All other node_modules → single vendor chunk
            return 'vendor';
          }
        },
      },
    },
  },
})

