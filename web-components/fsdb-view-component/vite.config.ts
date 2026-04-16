import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'FsdbViewComponent',
      formats: ['es'],
      fileName: 'fsdb-view-component',
    },
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
