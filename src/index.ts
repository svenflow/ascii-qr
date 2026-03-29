/**
 * ascii-qr — Typographic QR code generator
 *
 * Generates QR codes rendered as ASCII/typographic art that actually scan.
 * Verifies scannability client-side before displaying.
 *
 * Note: This library requires a browser environment (DOM, Canvas, BarcodeDetector).
 */

export type { Style, ColorTheme, GenerateOptions, GenerateResult, QRMatrix, CharInfo, CharTable, CharTables } from './types'
export { MAX_URL_LENGTH } from './types'
export { generateQRMatrix } from './qr'
export { buildCharTables, findBestChar } from './chars'
export { renderQR, renderReferenceQR } from './renderer'
export { generateAndVerify, initDetector } from './verify'

import type { GenerateOptions, GenerateResult } from './types'
import { MAX_URL_LENGTH } from './types'
import { generateQRMatrix } from './qr'
import { buildCharTables } from './chars'
import { generateAndVerify } from './verify'

/**
 * Generate a scannable ASCII QR code on a canvas.
 *
 * @example
 * ```ts
 * import { generateAsciiQR } from 'ascii-qr'
 *
 * const canvas = document.getElementById('qr') as HTMLCanvasElement
 * const result = await generateAsciiQR({
 *   url: 'https://example.com',
 *   style: 'typographic',
 *   canvas,
 * })
 * console.log(result.scans) // true
 * ```
 */
export async function generateAsciiQR(options: GenerateOptions): Promise<GenerateResult> {
  const { url, style, calligramText, canvas, moduleSize, colorTheme } = options

  if (url.length > MAX_URL_LENGTH) {
    throw new Error(`URL too long (${url.length} chars). Maximum is ${MAX_URL_LENGTH} for QR code version 40-H.`)
  }

  const matrix = generateQRMatrix(url)
  // Font size is 87.5% of module size to avoid clipping ascenders/descenders
  const fontSize = moduleSize ? Math.round(moduleSize * 0.875) : 14
  const tables = await buildCharTables(fontSize)

  const result = await generateAndVerify(
    canvas,
    matrix,
    tables,
    url,
    style,
    calligramText,
    moduleSize,
    undefined, // onStatus
    colorTheme,
  )

  return {
    scans: result.scans,
    contrastLevel: result.contrastLevel,
    attempts: result.attempts,
    fellBack: result.fellBack,
  }
}
