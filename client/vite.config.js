const { defineConfig } = require('vite');
const vue = require('@vitejs/plugin-vue');

module.exports = defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    // Monaco 与 Vite 依赖预构建在某些环境会冲突，排除后由运行时按需加载
    exclude: ['monaco-editor'],
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});

