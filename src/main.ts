import './styles.css'
import type { Style, ColorTheme, CharTables } from './types'
import { MAX_URL_LENGTH } from './types'
import { generateQRMatrix } from './qr'
import { buildCharTables } from './chars'
import { generateAndVerify, initDetector } from './verify'

// DOM elements
const urlInput = document.getElementById('url-input') as HTMLInputElement
const calligramInputGroup = document.getElementById('calligram-input-group') as HTMLDivElement
const calligramText = document.getElementById('calligram-text') as HTMLInputElement
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement
const outputArea = document.getElementById('output-area') as HTMLDivElement
const statusEl = document.getElementById('status') as HTMLDivElement
const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement
const canvasWrapper = document.querySelector('.canvas-wrapper') as HTMLDivElement
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement

let currentStyle: Style = 'classic'
let currentTheme: ColorTheme = 'plasma'

// Pre-initialize expensive resources on page load
// BarcodeDetector WASM init + char table measurement happen once, reused across generates
let cachedTables: CharTables | null = null
const MODULE_SIZE = 20
const FONT_SIZE = 17

async function ensureInitialized(): Promise<CharTables> {
  if (!cachedTables) {
    cachedTables = await buildCharTables(FONT_SIZE)
  }
  return cachedTables
}

// Eagerly init detector and char tables on page load
void Promise.all([initDetector(), ensureInitialized()])

// Style radio buttons
document.querySelectorAll<HTMLInputElement>('input[name="style"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    currentStyle = radio.value as Style
    calligramInputGroup.style.display = currentStyle === 'calligram' ? 'flex' : 'none'
  })
})

// Color theme radio buttons
document.querySelectorAll<HTMLInputElement>('input[name="theme"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    currentTheme = radio.value as ColorTheme
  })
})

// Generate button
generateBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim()
  if (!url) {
    setStatus('Please enter a URL', 'error')
    return
  }

  if (url.length > MAX_URL_LENGTH) {
    setStatus(`URL too long (${url.length} chars, max ${MAX_URL_LENGTH})`, 'error')
    return
  }

  generateBtn.disabled = true
  outputArea.style.display = 'block'
  // Apply glow effect matching the selected theme
  canvasWrapper.className = `canvas-wrapper glow-${currentTheme}`
  setStatus('Generating...', 'generating')

  const t0 = performance.now()

  try {
    const matrix = generateQRMatrix(url)
    const tables = await ensureInitialized()

    const result = await generateAndVerify(
      canvas,
      matrix,
      tables,
      url,
      currentStyle,
      currentStyle === 'calligram' ? calligramText.value : undefined,
      MODULE_SIZE,
      setStatus,
      currentTheme,
    )

    const elapsed = Math.round(performance.now() - t0)

    if (result.scans) {
      if (result.fellBack) {
        setStatus(
          `Fell back to classic mode for reliable scanning (${result.attempts} attempts, ${elapsed}ms)`,
          'fallback'
        )
      } else {
        setStatus(
          `Scannable (attempt ${result.attempts}, contrast ${Math.round(result.contrastLevel * 100)}%, ${elapsed}ms)`,
          'success'
        )
      }
    } else {
      setStatus('Could not verify scan — QR may not be scannable', 'error')
    }
  } catch (e) {
    console.error('Generation error:', e)
    setStatus(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error')
  } finally {
    generateBtn.disabled = false
  }
})

// Copy to clipboard
copyBtn.addEventListener('click', async () => {
  try {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png')
    })
    if (!blob) {
      console.error('Failed to create image blob')
      return
    }
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ])
    copyBtn.textContent = 'Copied!'
    setTimeout(() => { copyBtn.textContent = 'Copy to Clipboard' }, 2000)
  } catch (e) {
    console.error('Copy failed:', e)
    copyBtn.textContent = 'Copy failed'
    setTimeout(() => { copyBtn.textContent = 'Copy to Clipboard' }, 2000)
  }
})

// Download PNG
downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a')
  link.download = 'ascii-qr.png'
  link.href = canvas.toDataURL('image/png')
  link.click()
})

function setStatus(text: string, className: string): void {
  statusEl.textContent = text
  statusEl.className = `status ${className}`
}
