import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/gsap/') || id.includes('/node_modules/@gsap/')) return 'motion';
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/react-router')) return 'react-vendor';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/dataset': 'http://localhost:3001',
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
});
