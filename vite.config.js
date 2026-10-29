import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // مسیر مطلق — برای BrowserRouter و URLهای تمیز (لازم برای سئو) ضروری است
  base: '/',
  server: {
 port: 3000, host: '0.0.0.0', open: false, allowedHosts: true,
 // پروکسی API به بک‌اند واقعی (Express + SQLite روی پورت ۴۰۰۰)
 proxy: {
 '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true },
 },
 },
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
