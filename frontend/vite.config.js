import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: './',
    plugins: [react()],
    server: {
      cors: true,
      proxy: {
        '/api': {
          target: env.BACKEND_URL || 'http://localhost:8000',
          changeOrigin: true,
          ws: true,
          headers: { 'Access-Control-Allow-Origin': '*' },
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react'
              if (id.includes('@mui/x-data-grid') || id.includes('@mui/x-')) return 'vendor-datagrid'
              if (id.includes('@mui/') || id.includes('@emotion/')) return 'vendor-mui'
              if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
              if (id.includes('@clerk/')) return 'vendor-clerk'
              if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf'
              if (id.includes('gsap')) return 'vendor-gsap'
              return 'vendor'
            }
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/setupTests.js',
    },
  }
})