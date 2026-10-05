import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8080' },
  },
  build: {
    // 直接构建到后端静态目录，单容器即可同时托管 API 与前端
    outDir: '../server/public',
    emptyOutDir: true,
  },
});
