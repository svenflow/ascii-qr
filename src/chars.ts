import type { CharInfo, CharTable } from './types'

// Full character set: printable ASCII + Unicode block chars
const CHAR_SET = [
  ' ', '!', '"', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  ':', ';', '<', '=', '>', '?', '@',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '[', '\\', ']', '^', '_', '`',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  '{', '|', '}', '~',
  // Unicode block characters
  '\u2588', // █ FULL BLOCK
  '\u2593', // ▓ DARK SHADE
  '\u2592', // ▒ MEDIUM SHADE
  '\u2591', // ░ LIGHT SHADE
  '\u2590', // ▐ RIGHT HALF BLOCK
  '\u258C', // ▌ LEFT HALF BLOCK
  '\u2580', // ▀ UPPER HALF BLOCK
  '\u2584', // ▄ LOWER HALF BLOCK
]

/**
 * Measure the ink density and rendered width of each character
 * for a given font configuration.
 */
function measureCharacters(
  font: string,
  weight: number,
  fontSize: number
): CharInfo[] {
  const cellSize = Math.ceil(fontSize * 1.5)
  const canvas = document.createElement('canvas')
  canvas.width = cellSize
  canvas.height = cellSize
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  const fontStr = `${weight} ${fontSize}px ${font}`

  // Measure each character
  const results: CharInfo[] = []

  for (const char of CHAR_SET) {
    // Measure width
    ctx.font = fontStr
    const metrics = ctx.measureText(char)
    const width = metrics.width

    // Measure ink density by rendering and counting dark pixels
    ctx.clearRect(0, 0, cellSize, cellSize)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, cellSize, cellSize)
    ctx.fillStyle = '#fff'
    ctx.font = fontStr
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(char, cellSize / 2, cellSize / 2)

    const imageData = ctx.getImageData(0, 0, cellSize, cellSize)
    const pixels = imageData.data
    let whitePixels = 0
    const totalPixels = cellSize * cellSize

    for (let i = 0; i < pixels.length; i += 4) {
      // Count pixels that are brighter than the black background
      if (pixels[i] > 128) whitePixels++
    }

    const density = whitePixels / totalPixels

    results.push({ char, density, width })
  }

  // Sort by density
  results.sort((a, b) => a.density - b.density)

  return results
}

/**
 * Build character tables for all font configurations needed.
 * Must be called AFTER fonts are loaded.
 */
export async function buildCharTables(fontSize: number = 14): Promise<{
  classic: CharTable
  typographic300: CharTable
  typographic500: CharTable
  typographic800: CharTable
}> {
  // Wait for fonts to load
  await Promise.all([
    document.fonts.load(`300 ${fontSize}px Georgia`),
    document.fonts.load(`500 ${fontSize}px Georgia`),
    document.fonts.load(`800 ${fontSize}px Georgia`),
    document.fonts.load(`400 ${fontSize}px "JetBrains Mono"`),
  ])

  return {
    classic: {
      font: '"JetBrains Mono", monospace',
      weight: 400,
      fontSize,
      chars: measureCharacters('"JetBrains Mono", monospace', 400, fontSize),
    },
    typographic300: {
      font: 'Georgia, serif',
      weight: 300,
      fontSize,
      chars: measureCharacters('Georgia, serif', 300, fontSize),
    },
    typographic500: {
      font: 'Georgia, serif',
      weight: 500,
      fontSize,
      chars: measureCharacters('Georgia, serif', 500, fontSize),
    },
    typographic800: {
      font: 'Georgia, serif',
      weight: 800,
      fontSize,
      chars: measureCharacters('Georgia, serif', 800, fontSize),
    },
  }
}

/**
 * Find the best character for a target density and cell width.
 * Balances brightness matching with width matching.
 */
export function findBestChar(
  table: CharTable,
  targetDensity: number,
  cellWidth: number
): CharInfo {
  const { chars } = table

  let bestScore = Infinity
  let bestChar = chars[0]

  for (const c of chars) {
    // Density error (0-1 scale)
    const densityError = Math.abs(c.density - targetDensity)
    // Width error: how well does this char fill the cell (0-1 scale)
    const widthRatio = c.width / cellWidth
    const widthError = Math.abs(1 - widthRatio)
    // Combined score: density is more important (70/30 weight)
    const score = densityError * 0.7 + widthError * 0.3
    if (score < bestScore) {
      bestScore = score
      bestChar = c
    }
  }

  return bestChar
}

