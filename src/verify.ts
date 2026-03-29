import { BarcodeDetector } from 'barcode-detector/ponyfill'
import type { QRMatrix, Style, VerifyResult, CharTables, ColorTheme } from './types'
import { renderQR, renderReferenceQR } from './renderer'

const CONTRAST_LEVELS = [0.7, 0.85, 1.0] as const

// Cached detector instance — WASM init is expensive, only do it once
let cachedDetector: InstanceType<typeof BarcodeDetector> | null = null

async function getDetector(): Promise<InstanceType<typeof BarcodeDetector>> {
  if (!cachedDetector) {
    cachedDetector = new BarcodeDetector({ formats: ['qr_code'] })
  }
  return cachedDetector
}

/**
 * Pre-initialize the BarcodeDetector so first scan is instant.
 * Call this on page load.
 */
export async function initDetector(): Promise<void> {
  await getDetector()
}

/**
 * Verify that a rendered QR code on a canvas can be decoded to the expected URL.
 */
async function scanCanvas(canvas: HTMLCanvasElement, expectedUrl: string): Promise<boolean> {
  try {
    const detector = await getDetector()
    const bmp = await createImageBitmap(canvas)
    const results = await detector.detect(bmp)
    bmp.close()

    for (const result of results) {
      if (result.rawValue === expectedUrl) return true
    }
    return false
  } catch (e) {
    console.error('BarcodeDetector error:', e)
    return false
  }
}

/**
 * Generate and verify a QR code with automatic retry and contrast escalation.
 *
 * Attempts rendering at increasing contrast levels. If all fail for the requested
 * style, falls back to Classic mode which is guaranteed to scan.
 */
export async function generateAndVerify(
  canvas: HTMLCanvasElement,
  matrix: QRMatrix,
  tables: CharTables,
  url: string,
  style: Style,
  calligramText?: string,
  moduleSize?: number,
  onStatus?: (status: string, className: string) => void,
  colorTheme?: ColorTheme,
  logoImage?: ImageBitmap,
  mosaicImage?: ImageBitmap,
): Promise<VerifyResult> {
  const debug = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).has('debug')
    : false

  // Try the requested style at increasing contrast levels
  for (let i = 0; i < CONTRAST_LEVELS.length; i++) {
    const contrastLevel = CONTRAST_LEVELS[i]
    onStatus?.(
      `Rendering (contrast ${Math.round(contrastLevel * 100)}%)...`,
      'generating'
    )

    renderQR(canvas, matrix, tables, {
      style,
      contrastLevel,
      calligramText,
      moduleSize,
      debug,
      colorTheme,
      logoImage,
      mosaicImage,
    })

    onStatus?.('Verifying scan...', 'verifying')

    const scans = await scanCanvas(canvas, url)
    if (scans) {
      return {
        scans: true,
        decodedValue: url,
        contrastLevel,
        attempts: i + 1,
        fellBack: false,
      }
    }
  }

  // Fallback: try classic at max contrast
  if (style !== 'classic') {
    onStatus?.('Falling back to classic...', 'fallback')

    renderQR(canvas, matrix, tables, {
      style: 'classic',
      contrastLevel: 1.0,
      moduleSize,
      debug,
      colorTheme,
      logoImage,
      mosaicImage,
    })

    const scans = await scanCanvas(canvas, url)
    if (scans) {
      return {
        scans: true,
        decodedValue: url,
        contrastLevel: 1.0,
        attempts: CONTRAST_LEVELS.length + 1,
        fellBack: true,
      }
    }
  }

  // Ultimate fallback: plain solid-square reference QR
  onStatus?.('Using reference QR...', 'fallback')
  renderReferenceQR(canvas, matrix, moduleSize)

  const scans = await scanCanvas(canvas, url)
  return {
    scans,
    decodedValue: scans ? url : null,
    contrastLevel: 1.0,
    attempts: CONTRAST_LEVELS.length + 2,
    fellBack: true,
  }
}
