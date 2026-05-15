import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ResortPro',
      fileName: 'embed',
      formats: ['iife'],   // single self-contained IIFE — no module system needed on host
    },
    rollupOptions: {
      // Bundle everything — host site may have no build system at all
      external: [],
      output: {
        // Inline CSS into the JS bundle so owners only need one <script> tag
        assetFileNames: 'embed.[ext]',
        inlineDynamicImports: true,
      },
    },
    minify: 'terser',
    target: 'es2018',
    outDir: 'dist',
    cssCodeSplit: false,
  },
})
