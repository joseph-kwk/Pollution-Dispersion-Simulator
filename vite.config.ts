import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: '.',
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    cors: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  optimizeDeps: {
    include: ['three', 'zustand', 'lucide-react']
  },
  define: {
    __VERSION__: JSON.stringify(process.env.npm_package_version),
    'window.__ENV__': {
      VITE_OPENWEATHER_API_KEY: JSON.stringify(process.env.VITE_OPENWEATHER_API_KEY || ''),
      VITE_SATELLITE_API_KEY: JSON.stringify(process.env.VITE_SATELLITE_API_KEY || ''),
      VITE_WATER_QUALITY_API_KEY: JSON.stringify(process.env.VITE_WATER_QUALITY_API_KEY || '')
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
