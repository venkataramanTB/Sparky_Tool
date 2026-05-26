import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // loadEnv reads all .env files for the current mode.
  // The empty-string prefix means it loads EVERY variable (including non-VITE_ ones),
  // so BACKEND_URL is available here even though the browser never sees it.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      // Allow cross-origin requests to the Vite dev server itself.
      cors: true,
      // Dev proxy: rewrites /api → backend.
      // Change BACKEND_URL in .env to point at a different local port or staging URL.
      proxy: {
        '/api': {
          target: env.BACKEND_URL || 'http://localhost:8000',
          changeOrigin: true,
          headers: { 'Access-Control-Allow-Origin': '*' },
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
