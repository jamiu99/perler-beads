import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
    open: false // 禁用自动打开浏览器
  },
  css: {
    postcss: false // 禁用 PostCSS
  },
  build: {
    outDir: 'dist'
  }
})
