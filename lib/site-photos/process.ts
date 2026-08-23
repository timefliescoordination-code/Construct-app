import sharp from 'sharp'
import { SITE_PHOTO_UPLOAD_CONFIG } from '@/lib/site-photos/constants'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function compressAndWatermarkSitePhoto(
  inputBuffer: Buffer,
  watermarkText: string,
  mimeType: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const resized = await sharp(inputBuffer)
    .rotate()
    .resize({
      width: SITE_PHOTO_UPLOAD_CONFIG.maxDimension,
      height: SITE_PHOTO_UPLOAD_CONFIG.maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer()

  const metadata = await sharp(resized).metadata()
  const width = metadata.width ?? 1200
  const height = metadata.height ?? 800
  const fontSize = Math.max(18, Math.round(Math.min(width, height) / 24))

  const svg = `
    <svg width="${width}" height="${height}">
      <style>
        .wm {
          fill: rgba(255,255,255,0.55);
          stroke: rgba(0,0,0,0.35);
          stroke-width: 1.5;
          paint-order: stroke fill;
          font-size: ${fontSize}px;
          font-family: Arial, Helvetica, sans-serif;
          font-weight: 700;
        }
      </style>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="wm">
        ${escapeXml(watermarkText)}
      </text>
    </svg>
  `

  const watermarked = await sharp(resized)
    .composite([{ input: Buffer.from(svg), gravity: 'center' }])
    .toBuffer()

  const useWebp = mimeType === 'image/webp'
  const contentType = useWebp ? 'image/webp' : 'image/jpeg'
  const output = useWebp
    ? await sharp(watermarked).webp({ quality: SITE_PHOTO_UPLOAD_CONFIG.webpQuality }).toBuffer()
    : await sharp(watermarked)
        .jpeg({ quality: SITE_PHOTO_UPLOAD_CONFIG.jpegQuality, mozjpeg: true })
        .toBuffer()

  return { buffer: output, contentType }
}
