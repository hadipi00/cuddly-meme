import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // مسیرهای نسبی → بیلد روی هر هاستی (ریشه یا زیرپوشه مثل GitHub Pages) کار می‌کند
  base: './',
  server: { port: 3000, host: '0.0.0.0', open: false, allowedHosts: true },
  preview: { port: 4173, host: '0.0.0.0', open: false, allowedHosts: true },
  build: {
    rollupOptions: {
      output: {
        // کتابخانه‌های مشترک در یک چانک جدا → کش بهتر در مرورگر
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
