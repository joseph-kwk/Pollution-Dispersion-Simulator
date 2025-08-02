import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        manualChunks: {
          'physics': ['./scripts/advancedPhysics.js'],
          'visualization': ['./scripts/advancedVisualization.js'],
          'gpu': ['./scripts/gpuAcceleration.js'],
          'data': ['./scripts/realWorldData.js'],
          'validation': ['./scripts/validationFramework.js']
        }
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
    include: ['gl-matrix', 'd3', 'three']
  },
  define: {
    __VERSION__: JSON.stringify(process.env.npm_package_version)
  },
  plugins: []
});
