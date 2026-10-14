import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 3003,
    strictPort: true,
    // Codespaces の転送 URL (*.app.github.dev) からのアクセスを許可する
    allowedHosts: ['.app.github.dev'],
  },
  // MuJoCo の WASM ローダーは事前バンドルすると壊れるので除外する
  optimizeDeps: {
    exclude: ['@mujoco/mujoco'],
  },
  build: {
    target: 'es2022',
  },
});
