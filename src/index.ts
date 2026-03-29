/**
 * ascii-qr — Typographic QR code generator
 *
 * Generates QR codes rendered as ASCII/typographic art that actually scan.
 * Verifies scannability client-side before displaying.
 *
 * Note: This library requires a browser environment (DOM, Canvas, BarcodeDetector).
 */

export type { Style, GenerateOptions, GenerateResult, QRMatrix, CharInfo, CharTable, CharTables } from './types'
export { MAX_URL_LENGTH } from './types'
export { generateQRMatrix } from './qr'
export { buildCharTables, findBestChar } from './chars'
export { renderQR, renderReferenceQR } from './renderer'
export { generateAndVerify } from './verify'

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
  const { url, style, calligramText, canvas, moduleSize } = options

  if (url.length > MAX_URL_LENGTH) {
    throw new Error(`URL too long (${url.length} chars). Maximum is ${MAX_URL_LENGTH} for QR code version 40-H.`)
  }

  const matrix = generateQRMatrix(url)
  const tables = await buildCharTables(moduleSize ? Math.round(moduleSize * 0.875) : 14)

  const result = await generateAndVerify(
    canvas,
    matrix,
    tables,
    url,
    style,
    calligramText,
    moduleSize,
  )

  return {
    scans: result.scans,
    contrastLevel: result.contrastLevel,
    attempts: result.attempts,
    fellBack: result.fellBack,
  }
}
