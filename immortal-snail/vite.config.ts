import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sitePlugin } from './vite-plugin-site';

export default defineConfig({
  plugins: [react(), sitePlugin()],
  worker: { format: 'es' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 60000 },
} as never);
