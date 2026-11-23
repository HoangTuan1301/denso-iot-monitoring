import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // [PERF] Dạng hàm để chia chunk theo đúng thư mục node_modules.
        // Dạng object cũ khiến React bị gộp vào chunk recharts (vendor-react rỗng 0KB),
        // làm trang Login buộc phải tải cả recharts ~580KB.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|clsx|react-is|prop-types|tiny-invariant|eventemitter3|use-sync-external-store)[\\/]/.test(id)) return 'vendor-react';
          if (/[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|recharts-scale)[\\/]/.test(id)) return 'vendor-recharts';
          if (/[\\/]node_modules[\\/]three[\\/]/.test(id)) return 'vendor-three';
          if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) return 'vendor-icons';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:5000',
        ws: true,
      },
    },
  },
});
