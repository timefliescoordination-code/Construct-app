import sharp from 'sharp'
import { DEFAULT_WATERMARK_TEXT } from '@/lib/design/constants'

export function getWatermarkText(): string {
  return process.env.COMPANY_WATERMARK_NAME?.trim() || DEFAULT_WATERMARK_TEXT
}

export async function applyWatermarkToImage(
  inputBuffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const text = getWatermarkText()
  const image = sharp(inputBuffer)
  const metadata = await image.metadata()
  const width = metadata.width ?? 1200
  const height = metadata.height ?? 800

  const fontSize = Math.max(24, Math.round(Math.min(width, height) / 18))
  const svg = `
    <svg width="${width}" height="${height}">
      <defs>
        <style>
          .wm { fill: rgba(255,255,255,0.35); font-size: ${fontSize}px; font-family: Arial, sans-serif; font-weight: bold; }
        </style>
      </defs>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="wm" transform="rotate(-35, ${width / 2}, ${height / 2})">${escapeXml(text)}</text>
      <text x="50%" y="85%" text-anchor="middle" class="wm" font-size="${Math.round(fontSize * 0.6)}">${escapeXml(text)}</text>
    </svg>
  `

  const watermarked = await image
    .composite([{ input: Buffer.from(svg), gravity: 'center' }])
    .toBuffer()

  const contentType =
    mimeType === 'image/png'
      ? 'image/png'
      : mimeType === 'image/webp'
        ? 'image/webp'
        : 'image/jpeg'

  const output =
    contentType === 'image/png'
      ? await sharp(watermarked).png().toBuffer()
      : contentType === 'image/webp'
        ? await sharp(watermarked).webp().toBuffer()
        : await sharp(watermarked).jpeg({ quality: 90 }).toBuffer()

  return { buffer: output, contentType }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
