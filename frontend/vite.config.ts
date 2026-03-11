import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/mass-test-runner/',
  server: {
    host: '0.0.0.0',
    port: 3015,
    allowedHosts: ['bmlnxtest01.catmain.local'],
    proxy: {
      '/api': {
        target: 'http://bmlnxtest01.catmain.local:8000',
        changeOrigin: true,
      },
    },
  },
})
