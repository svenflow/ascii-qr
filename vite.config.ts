import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  if (mode === 'demo') {
    // Demo build for GitHub Pages
    return {
      base: '/ascii-qr/',
      build: {
        outDir: 'dist-demo',
        emptyOutDir: true,
      },
    }
  }

  // Library build
  return {
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'AsciiQR',
        fileName: 'index',
        formats: ['es'],
      },
      rollupOptions: {
        external: ['qrcode', 'barcode-detector', 'barcode-detector/ponyfill'],
      },
    },
  }
})
