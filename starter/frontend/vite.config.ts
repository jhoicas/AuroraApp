import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      // Sin VITE_API_URL el cliente usa /api/v1 (mismo origen): en dev se redirige al backend local.
      proxy: {
        '/api': env.VITE_DEV_PROXY_TARGET || 'http://localhost:8080',
      },
    },
  }
})
