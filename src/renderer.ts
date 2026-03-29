import type { QRMatrix, RenderOptions, CharTable, CharTables, ColorTheme } from './types'
import { isStructuralModule, countDarkNeighbors } from './qr'
import { findBestChar } from './chars'

const DEFAULT_MODULE_SIZE = 16

// Textflow-inspired density ramp: light → heavy visual weight
const RAMP_DENSE = ' .`-:;=+*#%@$'

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: false })
  if (!ctx) throw new Error('Could not get 2D canvas context — is this a valid canvas element?')
  return ctx
}

// --- Color theme functions ---
// Each returns [h, s, l] for a given cell position

interface ThemeColor { h: number; s: number; l: number }

const THEME_FUNCTIONS: Record<ColorTheme, (row: number, col: number, totalSize: number, isDark: boolean) => ThemeColor> = {
  plasma: (row, col, totalSize) => {
    const nx = col / totalSize
    const ny = row / totalSize
    const v = (Math.sin(nx * 8 + ny * 3) + Math.sin(ny * 7 - nx * 2) + Math.sin((nx + ny) * 5)) / 3
    const h = ((v * 0.5 + 0.5) * 270 + col * 3 + row * 2) % 360
    return { h, s: 80, l: 55 }
  },
  matrix: (_row, _col) => {
    return { h: 120, s: 90, l: 50 + Math.random() * 15 }
  },
  lava: (row, col, totalSize) => {
    const nx = col / totalSize
    const ny = row / totalSize
    const v = (Math.sin(nx * 6 + ny * 4) + Math.sin(ny * 8)) / 2 * 0.5 + 0.5
    const h = 10 + v * 40 // 10-50: red → orange → yellow
    return { h, s: 90, l: 40 + v * 25 }
  },
  aurora: (row, col, totalSize) => {
    const ny = row / totalSize
    const nx = col / totalSize
    const wave = Math.sin(nx * 6 + ny * 2) * 0.5 + 0.5
    const h = 120 + wave * 160 // green → cyan → purple
    return { h, s: 70, l: 45 + wave * 20 }
  },
  mono: () => {
    return { h: 0, s: 0, l: 85 }
  },
}

function getStructuralColor(theme: ColorTheme): string {
  switch (theme) {
    case 'plasma': return 'hsl(280, 100%, 75%)'
    case 'matrix': return 'hsl(120, 100%, 70%)'
    case 'lava': return 'hsl(40, 100%, 70%)'
    case 'aurora': return 'hsl(160, 90%, 70%)'
    case 'mono': return '#ffffff'
  }
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
  const theme: ColorTheme = options.colorTheme ?? 'mono'

  canvas.width = canvasSize
  canvas.height = canvasSize

  const ctx = getContext(canvas)
  ctx.imageSmoothingEnabled = false

  // Always dark background for colored modes, white for classic
  if (options.style === 'classic' && theme === 'mono') {
    ctx.fillStyle = '#ffffff'
  } else {
    ctx.fillStyle = '#0a0a0f' // textflow's deep near-black
  }
  ctx.fillRect(0, 0, canvasSize, canvasSize)

  const { contrastLevel } = options
  const themeFunc = THEME_FUNCTIONS[theme]

  // Calligram state
  let calligramIndex = 0
  const calligramText = (options.calligramText ?? 'HELLO').toUpperCase().replace(/\s+/g, '')

  // Mosaic: sample photo brightness and color per module
  let mosaicData: { brightness: number; r: number; g: number; b: number }[][] | null = null
  if (options.style === 'mosaic' && options.mosaicImage) {
    mosaicData = sampleMosaicImage(options.mosaicImage, totalSize)
  }

  for (let row = 0; row < totalSize; row++) {
    for (let col = 0; col < totalSize; col++) {
      const isDark = modules[row][col]
      const x = col * moduleSize
      const y = row * moduleSize
      const structural = isStructuralModule(row, col, matrix)

      if (options.style === 'mosaic' && mosaicData) {
        renderMosaicCell(ctx, x, y, moduleSize, isDark, structural, contrastLevel, row, col, totalSize, theme, mosaicData)
      } else if (options.style === 'classic' && theme === 'mono') {
        // Original monochrome classic
        renderClassicCell(ctx, x, y, moduleSize, isDark, structural, contrastLevel, tables.classic)
      } else if (options.style === 'classic') {
        // Colored classic: solid color blocks
        renderColoredClassicCell(ctx, x, y, moduleSize, isDark, structural, contrastLevel, row, col, totalSize, theme, themeFunc)
      } else if (options.style === 'typographic') {
        const table = getTypographicTable(row, col, isDark, structural, matrix, tables)
        renderColoredTypographicCell(ctx, x, y, moduleSize, isDark, structural, contrastLevel, table, row, col, totalSize, theme, themeFunc)
      } else if (options.style === 'calligram') {
        const result = renderColoredCalligramCell(
          ctx, x, y, moduleSize, isDark, structural, contrastLevel,
          tables.typographic800, calligramText, calligramIndex,
          row, col, totalSize, theme, themeFunc
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

  // Draw logo overlay in center if provided
  if (options.logoImage) {
    drawLogoOverlay(ctx, canvasSize, options.logoImage, options.logoScale ?? 0.2, theme)
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

// --- Classic monochrome (original) ---

function renderClassicCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  isDark: boolean,
  structural: boolean,
  contrastLevel: number,
  table: CharTable
): void {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, size, size)

  if (!isDark) return

  if (structural) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(x, y, size, size)
    return
  }

  const targetDensity = contrastLevel
  const charInfo = findBestChar(table, targetDensity, size)

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

// --- Colored classic: solid colored blocks with density char ---

function renderColoredClassicCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  isDark: boolean,
  structural: boolean,
  contrastLevel: number,
  row: number, col: number, totalSize: number,
  theme: ColorTheme,
  themeFunc: (r: number, c: number, t: number, d: boolean) => ThemeColor
): void {
  if (!isDark) return // dark bg already drawn

  if (structural) {
    ctx.fillStyle = getStructuralColor(theme)
    ctx.fillRect(x, y, size, size)
    return
  }

  const { h, s, l } = themeFunc(row, col, totalSize, true)
  const charIdx = Math.floor(contrastLevel * (RAMP_DENSE.length - 1))
  const char = RAMP_DENSE[Math.min(charIdx, RAMP_DENSE.length - 1)]

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, size, size)
  ctx.clip()

  ctx.fillStyle = `hsl(${h}, ${s}%, ${l}%)`
  const fontSize = Math.round(size * 0.9)
  ctx.font = `700 ${fontSize}px "JetBrains Mono", monospace`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(char, x + size / 2, y + size / 2)

  ctx.restore()
}

// --- Colored typographic: proportional serif with HSL color ---

function renderColoredTypographicCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  isDark: boolean,
  structural: boolean,
  contrastLevel: number,
  table: CharTable,
  row: number, col: number, totalSize: number,
  theme: ColorTheme,
  themeFunc: (r: number, c: number, t: number, d: boolean) => ThemeColor
): void {
  if (!isDark) return

  if (structural) {
    ctx.fillStyle = getStructuralColor(theme)
    ctx.fillRect(x, y, size, size)
    return
  }

  const { h, s, l } = themeFunc(row, col, totalSize, true)
  const targetDensity = contrastLevel
  const charInfo = findBestChar(table, targetDensity, size)

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, size, size)
  ctx.clip()

  ctx.fillStyle = `hsl(${h}, ${s}%, ${l}%)`
  ctx.font = `${table.weight} ${table.fontSize}px ${table.font}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(charInfo.char, x + size / 2, y + size / 2)

  ctx.restore()
}

// --- Colored calligram: custom text with color ---

function renderColoredCalligramCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  isDark: boolean,
  structural: boolean,
  _contrastLevel: number,
  table: CharTable,
  text: string,
  currentIndex: number,
  row: number, col: number, totalSize: number,
  theme: ColorTheme,
  themeFunc: (r: number, c: number, t: number, d: boolean) => ThemeColor
): { nextIndex: number } {
  if (!isDark) return { nextIndex: currentIndex }

  if (structural) {
    ctx.fillStyle = getStructuralColor(theme)
    ctx.fillRect(x, y, size, size)
    return { nextIndex: currentIndex }
  }

  const { h, s, l } = themeFunc(row, col, totalSize, true)

  // Dark background tint for the cell (to ensure scanner sees "dark")
  const bgL = Math.max(5, l * 0.15)
  ctx.fillStyle = `hsl(${h}, ${Math.round(s * 0.3)}%, ${bgL}%)`
  ctx.fillRect(x, y, size, size)

  const char = text[currentIndex % text.length]
  const nextIndex = (currentIndex + 1) % text.length

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, size, size)
  ctx.clip()

  // Character slightly brighter than bg, with saturation
  const charL = Math.min(bgL + 15, l * 0.4)
  ctx.fillStyle = `hsl(${h}, ${s}%, ${charL}%)`
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
  if (!isDark) return tables.typographic500
  if (structural) return tables.typographic800
  const neighbors = countDarkNeighbors(row, col, matrix.modules)
  if (neighbors >= 3) return tables.typographic800
  if (neighbors >= 1) return tables.typographic500
  return tables.typographic300
}

// --- Mosaic: photo-to-QR rendering ---

function sampleMosaicImage(
  img: ImageBitmap,
  gridSize: number
): { brightness: number; r: number; g: number; b: number }[][] {
  // Draw image to offscreen canvas at grid resolution for sampling
  const sampleCanvas = new OffscreenCanvas(gridSize, gridSize)
  const sCtx = sampleCanvas.getContext('2d')!
  sCtx.drawImage(img, 0, 0, gridSize, gridSize)
  const imageData = sCtx.getImageData(0, 0, gridSize, gridSize)
  const pixels = imageData.data

  const grid: { brightness: number; r: number; g: number; b: number }[][] = []
  for (let row = 0; row < gridSize; row++) {
    grid[row] = []
    for (let col = 0; col < gridSize; col++) {
      const idx = (row * gridSize + col) * 4
      const r = pixels[idx]
      const g = pixels[idx + 1]
      const b = pixels[idx + 2]
      // Perceptual brightness (ITU-R BT.601)
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      grid[row][col] = { brightness, r, g, b }
    }
  }
  return grid
}

function renderMosaicCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  isDark: boolean,
  structural: boolean,
  contrastLevel: number,
  row: number, col: number, _totalSize: number,
  _theme: ColorTheme,
  mosaicData: { brightness: number; r: number; g: number; b: number }[][]
): void {
  const pixel = mosaicData[row]?.[col] ?? { brightness: 0.5, r: 128, g: 128, b: 128 }

  if (!isDark) {
    // Light module: bright fill so scanner sees "white"
    // Use a brightened version of the photo color
    const lightR = Math.min(255, Math.round(pixel.r * 0.3 + 180))
    const lightG = Math.min(255, Math.round(pixel.g * 0.3 + 180))
    const lightB = Math.min(255, Math.round(pixel.b * 0.3 + 180))
    ctx.fillStyle = `rgb(${lightR}, ${lightG}, ${lightB})`
    ctx.fillRect(x, y, size, size)
    return
  }

  if (structural) {
    // Structural modules: solid dark with photo color tint
    const structR = Math.round(pixel.r * 0.3 + 20)
    const structG = Math.round(pixel.g * 0.3 + 20)
    const structB = Math.round(pixel.b * 0.3 + 20)
    ctx.fillStyle = `rgb(${structR}, ${structG}, ${structB})`
    ctx.fillRect(x, y, size, size)
    return
  }

  // Dark background fill — scanner needs this to be dark
  // Use a dimmed version of the photo color as background
  const bgR = Math.round(pixel.r * 0.08)
  const bgG = Math.round(pixel.g * 0.08)
  const bgB = Math.round(pixel.b * 0.08)
  ctx.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`
  ctx.fillRect(x, y, size, size)

  // Pick character from density ramp — minimum density ensures scannability
  // Photo brightness modulates which char, but always at least medium density
  const minDensity = 0.4 * contrastLevel
  const photoDensity = (1 - pixel.brightness) * contrastLevel
  const density = Math.max(minDensity, photoDensity)
  const charIdx = Math.floor(density * (RAMP_DENSE.length - 1))
  const char = RAMP_DENSE[Math.min(charIdx, RAMP_DENSE.length - 1)]

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, size, size)
  ctx.clip()

  // Character in photo color, slightly boosted for vibrancy
  const lumBoost = 1.5
  const cr = Math.min(255, Math.round(pixel.r * lumBoost))
  const cg = Math.min(255, Math.round(pixel.g * lumBoost))
  const cb = Math.min(255, Math.round(pixel.b * lumBoost))
  ctx.fillStyle = `rgb(${cr}, ${cg}, ${cb})`

  const fontSize = Math.round(size * 0.9)
  ctx.font = `700 ${fontSize}px "JetBrains Mono", monospace`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(char, x + size / 2, y + size / 2)

  ctx.restore()
}

// --- Logo overlay ---

function drawLogoOverlay(
  ctx: CanvasRenderingContext2D,
  canvasSize: number,
  logo: ImageBitmap,
  scale: number,
  theme: ColorTheme
): void {
  const logoSize = Math.round(canvasSize * Math.min(scale, 0.25))
  const x = Math.round((canvasSize - logoSize) / 2)
  const y = Math.round((canvasSize - logoSize) / 2)

  // Background pad with rounded corners
  const pad = Math.round(logoSize * 0.12)
  const bgX = x - pad
  const bgY = y - pad
  const bgSize = logoSize + pad * 2
  const radius = Math.round(bgSize * 0.15)

  // Dark or light background depending on theme
  const isDarkTheme = theme !== 'mono'
  ctx.fillStyle = isDarkTheme ? '#0a0a0f' : '#ffffff'

  ctx.beginPath()
  ctx.roundRect(bgX, bgY, bgSize, bgSize, radius)
  ctx.fill()

  // Optional subtle border
  ctx.strokeStyle = isDarkTheme ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Draw the logo image, maintaining aspect ratio
  const aspect = logo.width / logo.height
  let drawW = logoSize
  let drawH = logoSize
  if (aspect > 1) {
    drawH = logoSize / aspect
  } else {
    drawW = logoSize * aspect
  }
  const drawX = x + (logoSize - drawW) / 2
  const drawY = y + (logoSize - drawH) / 2

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(logo, drawX, drawY, drawW, drawH)
  ctx.imageSmoothingEnabled = false
}
