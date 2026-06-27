import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// shift_creation_app_final - 固定ポート: 5106
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5106,
    strictPort: true,
  }
})
