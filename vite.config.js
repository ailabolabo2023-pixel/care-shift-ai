import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// mystic-shifts (メイン) - 固定ポート: 5100
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5100,
    strictPort: true, // ポートが使用中でもエラーにして別ポートで起動しない
  }
})
