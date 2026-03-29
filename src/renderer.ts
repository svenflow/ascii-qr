import type { QRMatrix, RenderOptions, CharTable, CharTables } from './types'
import { isStructuralModule, countDarkNeighbors } from './qr'
import { findBestChar } from './chars'

const DEFAULT_MODULE_SIZE = 16

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: false })
  if (!ctx) throw new Error('Could not get 2D canvas context — is this a valid canvas element?')
  return ctx
}

/**
 * Render a QR matrix as ASCII art onto a canvas.
 */
export function renderQR(
  canvas: HTMLCanvasElement,
  matrix: QRMatrix,
  tables: CharTables,
  options: RenderOptions
): void {
  const moduleSize = options.moduleSize ?? DEFAULT_MODULE_SIZE
  const { totalSize, modules } = matrix
  const canvasSize = totalSize * moduleSize

  canvas.width = canvasSize
  canvas.height = canvasSize

  const ctx = getContext(canvas)
  ctx.imageSmoothingEnabled = false

  // Fill background
  if (options.style === 'typographic') {
    ctx.fillStyle = '#0a0a0a'
  } else {
    ctx.fillStyle = '#ffffff'
  }
  ctx.fillRect(0, 0, canvasSize, canvasSize)

  const { contrastLevel } = options

  // Calligram state
  let calligramIndex = 0
  const calligramText = (options.calligramText ?? 'HELLO').toUpperCase().replace(/\s+/g, '')

  for (let row = 0; row < totalSize; row++) {
    for (let col = 0; col < totalSize; col++) {
      const isDark = modules[row][col]
      const x = col * moduleSize
      const y = row * moduleSize
      const structural = isStructuralModule(row, col, matrix)

      if (options.style === 'classic') {
        renderClassicCell(ctx, x, y, moduleSize, isDark, structural, contrastLevel, tables.classic)
      } else if (options.style === 'typographic') {
        const table = getTypographicTable(row, col, isDark, structural, matrix, tables)
        renderTypographicCell(ctx, x, y, moduleSize, isDark, structural, contrastLevel, table)
      } else if (options.style === 'calligram') {
        const result = renderCalligramCell(
          ctx, x, y, moduleSize, isDark, structural, contrastLevel,
          tables.typographic800, calligramText, calligramIndex
        )
        calligramIndex = result.nextIndex
      }

      // Debug grid overlay
      if (options.debug) {
        ctx.strokeStyle = isDark ? 'rgba(255,0,0,0.3)' : 'rgba(0,0,255,0.15)'
        ctx.lineWidth = 0.5
        ctx.strokeRect(x, y, moduleSize, moduleSize)
      }
    }
  }
}

/**
 * Render a reference QR (solid squares, no ASCII art) for baseline scan testing.
 */
export function renderReferenceQR(
  canvas: HTMLCanvasElement,
  matrix: QRMatrix,
  moduleSize: number = DEFAULT_MODULE_SIZE
): void {
  const { totalSize, modules } = matrix
  const canvasSize = totalSize * moduleSize

  canvas.width = canvasSize
  canvas.height = canvasSize

  const ctx = getContext(canvas)
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasSize, canvasSize)

  for (let row = 0; row < totalSize; row++) {
    for (let col = 0; col < totalSize; col++) {
      if (modules[row][col]) {
        ctx.fillStyle = '#000000'
        ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize)
      }
    }
  }
}

// --- Cell renderers ---

function renderClassicCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  isDark: boolean,
  structural: boolean,
  contrastLevel: number,
  table: CharTable
): void {
  // White background for classic mode
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, size, size)

  if (!isDark) return

  if (structural) {
    // Solid black for structural modules
    ctx.fillStyle = '#000000'
    ctx.fillRect(x, y, size, size)
    return
  }

  // Find character with target density
  const targetDensity = contrastLevel
  const charInfo = findBestChar(table, targetDensity, size)

  // Clip to cell bounds
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, size, size)
  ctx.clip()

  ctx.fillStyle = '#000000'
  ctx.font = `${table.weight} ${table.fontSize}px ${table.font}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(charInfo.char, x + size / 2, y + size / 2)

  ctx.restore()
}

function renderTypographicCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  isDark: boolean,
  structural: boolean,
  contrastLevel: number,
  table: CharTable
): void {
  if (!isDark) return // dark background already drawn

  if (structural) {
    // Bright white for structural modules on dark bg
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x, y, size, size)
    return
  }

  // Light text on dark background
  const targetDensity = contrastLevel
  const charInfo = findBestChar(table, targetDensity, size)

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, size, size)
  ctx.clip()

  // Brightness scales with contrast level
  const brightness = Math.round(200 * contrastLevel + 55)
  ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`
  ctx.font = `${table.weight} ${table.fontSize}px ${table.font}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(charInfo.char, x + size / 2, y + size / 2)

  ctx.restore()
}

function renderCalligramCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  isDark: boolean,
  structural: boolean,
  contrastLevel: number,
  table: CharTable,
  text: string,
  currentIndex: number
): { nextIndex: number } {
  // White background for calligram
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, size, size)

  if (!isDark) return { nextIndex: currentIndex }

  if (structural) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(x, y, size, size)
    return { nextIndex: currentIndex }
  }

  // For calligram: fill the cell with a dark background at contrastLevel opacity,
  // then render the character on top in a slightly different shade so text is visible
  // but the cell reads as "dark" to the scanner
  const bgBrightness = Math.round(255 * (1 - contrastLevel) * 0.3)
  ctx.fillStyle = `rgb(${bgBrightness}, ${bgBrightness}, ${bgBrightness})`
  ctx.fillRect(x, y, size, size)

  // Get next character from the text
  const char = text[currentIndex % text.length]
  const nextIndex = (currentIndex + 1) % text.length

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, size, size)
  ctx.clip()

  // Render character slightly lighter than background so it's visible as texture
  // Ensure at least 15 brightness units difference so text is always visible
  const charBrightness = Math.min(bgBrightness + Math.max(40, 15), 120)
  ctx.fillStyle = `rgb(${charBrightness}, ${charBrightness}, ${charBrightness})`
  // Use a font size that fills the cell (87.5% to avoid clipping ascenders)
  const fontSize = Math.round(size * 0.875)
  ctx.font = `${table.weight} ${fontSize}px ${table.font}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(char, x + size / 2, y + size / 2)

  ctx.restore()

  return { nextIndex }
}

// --- Helpers ---

function getTypographicTable(
  row: number,
  col: number,
  isDark: boolean,
  structural: boolean,
  matrix: QRMatrix,
  tables: CharTables
): CharTable {
  if (!isDark) return tables.typographic500 // doesn't matter, won't render

  if (structural) return tables.typographic800

  // Weight by neighbor count
  const neighbors = countDarkNeighbors(row, col, matrix.modules)
  if (neighbors >= 3) return tables.typographic800  // core
  if (neighbors >= 1) return tables.typographic500  // edge
  return tables.typographic300                      // isolated / transition
}
