import QRCode from 'qrcode'
import type { QRMatrix } from './types'

const QUIET_ZONE = 4

/**
 * Generate a QR matrix from a URL string.
 * Returns a boolean grid with quiet zone padding.
 */
export function generateQRMatrix(url: string): QRMatrix {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'H' })
  const { size } = qr.modules
  const totalSize = size + QUIET_ZONE * 2

  // Build 2D boolean grid with quiet zone
  const modules: boolean[][] = []
  for (let row = 0; row < totalSize; row++) {
    const rowData: boolean[] = []
    for (let col = 0; col < totalSize; col++) {
      const qrRow = row - QUIET_ZONE
      const qrCol = col - QUIET_ZONE
      if (qrRow >= 0 && qrRow < size && qrCol >= 0 && qrCol < size) {
        rowData.push(qr.modules.get(qrRow, qrCol) === 1)
      } else {
        rowData.push(false) // quiet zone = light
      }
      }
    modules.push(rowData)
  }

  // Finder patterns: three 7x7 squares at corners (in quiet-zone-adjusted coords)
  const finderPatterns = [
    { row: QUIET_ZONE, col: QUIET_ZONE },                    // top-left
    { row: QUIET_ZONE, col: QUIET_ZONE + size - 7 },         // top-right
    { row: QUIET_ZONE + size - 7, col: QUIET_ZONE },         // bottom-left
  ]

  // Alignment patterns (version-dependent, extracted from QR data)
  const alignmentPatterns: Array<{ row: number; col: number }> = []
  // For versions >= 2, alignment patterns exist. We'll mark them based on the QR version.
  const version = qr.version
  if (version >= 2) {
    const alignPos = getAlignmentPositions(version)
    for (const row of alignPos) {
      for (const col of alignPos) {
        // Skip positions that overlap with finder patterns
        if (isFinderRegion(row, col, size)) continue
        alignmentPatterns.push({
          row: row + QUIET_ZONE,
          col: col + QUIET_ZONE,
        })
      }
    }
  }

  return { modules, size, totalSize, finderPatterns, alignmentPatterns }
}

/**
 * Check if a position in the QR grid is part of a finder pattern, timing pattern,
 * or alignment pattern (structural elements that need max contrast).
 */
export function isStructuralModule(
  row: number,
  col: number,
  matrix: QRMatrix
): boolean {
  // Check finder patterns (7x7 + 1 separator)
  for (const fp of matrix.finderPatterns) {
    if (
      row >= fp.row - 1 &&
      row <= fp.row + 7 &&
      col >= fp.col - 1 &&
      col <= fp.col + 7
    ) {
      return true
    }
  }

  // Check alignment patterns (5x5) — ap.row/col already include QUIET_ZONE offset
  for (const ap of matrix.alignmentPatterns) {
    if (
      row >= ap.row - 2 &&
      row <= ap.row + 2 &&
      col >= ap.col - 2 &&
      col <= ap.col + 2
    ) {
      return true
    }
  }

  // Timing patterns: row 6 and col 6 (in QR coords, adjusted for quiet zone)
  const qrRow = row - QUIET_ZONE
  const qrCol = col - QUIET_ZONE
  if (qrRow >= 0 && qrRow < matrix.size && qrCol >= 0 && qrCol < matrix.size) {
    if (qrRow === 6 || qrCol === 6) return true
  }

  return false
}

/** Count how many of the 4 cardinal neighbors are dark */
export function countDarkNeighbors(
  row: number,
  col: number,
  modules: boolean[][]
): number {
  const total = modules.length
  let count = 0
  if (row > 0 && modules[row - 1][col]) count++
  if (row < total - 1 && modules[row + 1][col]) count++
  if (col > 0 && modules[row][col - 1]) count++
  if (col < total - 1 && modules[row][col + 1]) count++
  return count
}

// --- Internal helpers ---

function isFinderRegion(row: number, col: number, size: number): boolean {
  // Top-left
  if (row <= 8 && col <= 8) return true
  // Top-right
  if (row <= 8 && col >= size - 8) return true
  // Bottom-left
  if (row >= size - 8 && col <= 8) return true
  return false
}

// Alignment pattern positions per QR version
function getAlignmentPositions(version: number): number[] {
  const table: Record<number, number[]> = {
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
    6: [6, 34],
    7: [6, 22, 38],
    8: [6, 24, 42],
    9: [6, 26, 46],
    10: [6, 28, 50],
    11: [6, 30, 54],
    12: [6, 32, 58],
    13: [6, 34, 62],
    14: [6, 26, 46, 66],
    15: [6, 26, 48, 70],
    16: [6, 26, 50, 74],
    17: [6, 30, 54, 78],
    18: [6, 30, 56, 82],
    19: [6, 30, 58, 86],
    20: [6, 34, 62, 90],
    21: [6, 28, 50, 72, 94],
    22: [6, 26, 50, 74, 98],
    23: [6, 30, 54, 78, 102],
    24: [6, 28, 54, 80, 106],
    25: [6, 32, 58, 84, 110],
    26: [6, 30, 58, 86, 114],
    27: [6, 34, 62, 90, 118],
    28: [6, 26, 50, 74, 98, 122],
    29: [6, 30, 54, 78, 102, 126],
    30: [6, 26, 52, 78, 104, 130],
    31: [6, 30, 56, 82, 108, 134],
    32: [6, 34, 60, 86, 112, 138],
    33: [6, 30, 58, 86, 114, 142],
    34: [6, 34, 62, 90, 118, 146],
    35: [6, 30, 54, 78, 102, 126, 150],
    36: [6, 24, 50, 76, 102, 128, 154],
    37: [6, 28, 54, 80, 106, 132, 158],
    38: [6, 32, 58, 84, 110, 136, 162],
    39: [6, 26, 54, 82, 110, 138, 166],
    40: [6, 30, 58, 86, 114, 142, 170],
  }
  return table[version] || []
}
