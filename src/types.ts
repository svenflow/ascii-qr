export type Style = 'classic' | 'typographic' | 'calligram'

export interface QRMatrix {
  /** 2D boolean grid: true = dark module */
  modules: boolean[][]
  /** Number of modules per side (not counting quiet zone) */
  size: number
  /** Total size including quiet zone */
  totalSize: number
  /** Finder pattern regions (row, col pairs for 7x7 squares) */
  finderPatterns: Array<{ row: number; col: number }>
  /** Alignment pattern centers */
  alignmentPatterns: Array<{ row: number; col: number }>
}

export interface CharInfo {
  char: string
  density: number
  width: number
}

export interface CharTable {
  font: string
  weight: number
  fontSize: number
  chars: CharInfo[]
}

export interface RenderOptions {
  style: Style
  contrastLevel: number
  calligramText?: string
  moduleSize?: number
  debug?: boolean
}

export interface VerifyResult {
  scans: boolean
  decodedValue: string | null
  contrastLevel: number
  attempts: number
  fellBack: boolean
}

export interface GenerateOptions {
  url: string
  style: Style
  calligramText?: string
  canvas: HTMLCanvasElement
  moduleSize?: number
}

export interface GenerateResult {
  scans: boolean
  contrastLevel: number
  attempts: number
  fellBack: boolean
}

/** Pre-built character tables for all rendering modes */
export interface CharTables {
  classic: CharTable
  typographic300: CharTable
  typographic500: CharTable
  typographic800: CharTable
}

/** Maximum URL length for QR code generation (version 40-H capacity) */
export const MAX_URL_LENGTH = 1273
