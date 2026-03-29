# ASCII QR

Typographic QR code generator — ASCII art QR codes that actually scan.

**[Live Demo](https://svenflow.github.io/ascii-qr/)**

## Features

- **Three render modes:** Classic (monospace), Typographic (proportional serif with weight variation), Calligram (custom text fills dark modules)
- **Verified scannability:** Every QR code is verified via BarcodeDetector before displaying
- **Automatic fallback:** If artistic mode can't scan, automatically escalates contrast and falls back to classic
- **Library + Demo:** Publishable npm package with a clean API, plus a demo web app

## Install

```bash
npm install ascii-qr
```

## Usage

```ts
import { generateAsciiQR } from 'ascii-qr'

const canvas = document.getElementById('qr') as HTMLCanvasElement
const result = await generateAsciiQR({
  url: 'https://example.com',
  style: 'typographic', // 'classic' | 'typographic' | 'calligram'
  canvas,
})

console.log(result.scans)         // true
console.log(result.contrastLevel) // 0.7
console.log(result.attempts)      // 1
console.log(result.fellBack)      // false
```

### Calligram mode

```ts
const result = await generateAsciiQR({
  url: 'https://example.com',
  style: 'calligram',
  calligramText: 'HELLO WORLD',
  canvas,
})
```

## How it works

1. Generate QR matrix with error correction level H (30% damage tolerance)
2. Map each QR module to ASCII characters by brightness and width
3. Render to canvas with cell clipping to prevent glyph spillover
4. Verify via BarcodeDetector (ZXing-WASM polyfill for cross-browser)
5. If scan fails, increase contrast and retry (up to 3 levels + classic fallback)

## Development

```bash
npm install
npm run dev        # Start dev server
npm run build      # Build library
npm run build:demo # Build demo for GitHub Pages
```

## Browser requirement

This library requires a browser environment (DOM, Canvas API). It uses the [barcode-detector](https://github.com/nichochar/barcode-detector) polyfill for cross-browser QR code detection.

## License

MIT
