import './styles.css'
import type { Style } from './types'
import { MAX_URL_LENGTH } from './types'
import { generateQRMatrix } from './qr'
import { buildCharTables } from './chars'
import { generateAndVerify } from './verify'

// DOM elements
const urlInput = document.getElementById('url-input') as HTMLInputElement
const calligramInputGroup = document.getElementById('calligram-input-group') as HTMLDivElement
const calligramText = document.getElementById('calligram-text') as HTMLInputElement
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement
const outputArea = document.getElementById('output-area') as HTMLDivElement
const statusEl = document.getElementById('status') as HTMLDivElement
const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement

let currentStyle: Style = 'classic'

// Style radio buttons
document.querySelectorAll<HTMLInputElement>('input[name="style"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    currentStyle = radio.value as Style
    calligramInputGroup.style.display = currentStyle === 'calligram' ? 'flex' : 'none'
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
  setStatus('Generating...', 'generating')

  try {
    const matrix = generateQRMatrix(url)
    const moduleSize = 16
    const tables = await buildCharTables(14)

    const result = await generateAndVerify(
      canvas,
      matrix,
      tables,
      url,
      currentStyle,
      currentStyle === 'calligram' ? calligramText.value : undefined,
      moduleSize,
      setStatus,
    )

    if (result.scans) {
      if (result.fellBack) {
        setStatus(
          `Fell back to classic mode for reliable scanning (${result.attempts} attempts)`,
          'fallback'
        )
      } else {
        setStatus(
          `Scannable (attempt ${result.attempts}, contrast ${Math.round(result.contrastLevel * 100)}%)`,
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
