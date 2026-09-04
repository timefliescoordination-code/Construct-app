import { absoluteAppUrl } from '../app-url.ts'
import type { PublicBlogImage } from './types.ts'

const FILE_LIKE = /\.(jpg|jpeg|png|webp|gif|pdf|dwg|xlsx|docx)$/i
const MAX_SITE_PHOTOS = 8
const MAX_DESIGN_IMAGES = 4

export function isImageMimeType(mime: string | null | undefined): boolean {
  return Boolean(mime?.trim().toLowerCase().startsWith('image/'))
}

export function safeImageCaption(raw: string | null | undefined, fallback: string): string {
  const title = raw?.trim() ?? ''
  if (!title) return fallback
  if (FILE_LIKE.test(title) || /https?:\/\//i.test(title)) return fallback
  if (title.length > 80) return fallback
  return title
}

export function marketingSitePhotoUrl(projectId: string, photoId: string): string {
  return absoluteAppUrl(`/api/projects/${projectId}/site-photos/${photoId}/view`)
}

export function marketingDesignFileUrl(projectId: string, fileId: string): string {
  return absoluteAppUrl(`/api/projects/${projectId}/design-files/${fileId}/view`)
}

type SitePhotoRow = {
  id?: unknown
  file_mime_type?: unknown
  stage_label?: unknown
  caption?: unknown
}

type DesignFileRow = {
  id?: unknown
  file_mime_type?: unknown
  title?: unknown
  revision_label?: unknown
}

export function collectProjectBlogImages(input: {
  projectId: string
  sitePhotos: SitePhotoRow[]
  designFiles: DesignFileRow[]
}): PublicBlogImage[] {
  const { projectId } = input
  const images: PublicBlogImage[] = []

  for (const row of input.designFiles) {
    if (images.filter((item) => item.kind === 'design').length >= MAX_DESIGN_IMAGES) break
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id || !isImageMimeType(typeof row.file_mime_type === 'string' ? row.file_mime_type : '')) {
      continue
    }
    const revision = typeof row.revision_label === 'string' ? row.revision_label.trim() : ''
    const fromTitle = safeImageCaption(
      typeof row.title === 'string' ? row.title : '',
      'Design drawing',
    )
    const caption =
      fromTitle === 'Design drawing' && revision && !FILE_LIKE.test(revision)
        ? `Design drawing · ${revision}`
        : fromTitle
    images.push({
      src: marketingDesignFileUrl(projectId, id),
      caption,
      kind: 'design',
    })
  }

  for (const row of input.sitePhotos) {
    if (images.filter((item) => item.kind === 'site').length >= MAX_SITE_PHOTOS) break
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id || !isImageMimeType(typeof row.file_mime_type === 'string' ? row.file_mime_type : '')) {
      continue
    }
    images.push({
      src: marketingSitePhotoUrl(projectId, id),
      caption: safeImageCaption(
        [row.stage_label, row.caption]
          .map((value) => (typeof value === 'string' ? value : ''))
          .find((value) => value.trim()) ?? '',
        'On site',
      ),
      kind: 'site',
    })
  }

  return images
}

export function formatBlogImagePromptNote(images: PublicBlogImage[]): string {
  const lines = [
    'Image slots (fill automatically when the project has Design-tab drawings or site photos):',
    '- featured_image: first available URL, or omit if none',
    '- one image_text section using that first image',
    '- gallery with every listed URL',
    'Use the captions given. Never invent a photo. Never use a file name as a caption.',
  ]
  if (!images.length) {
    lines.push(
      'Available images: none yet. Omit image, image_text, and gallery until Design or site photos are added — those slots fill on the next generate.',
    )
    return lines.join('\n')
  }
  lines.push('Available images:')
  for (const image of images) {
    lines.push(`- ${image.caption}: ${image.src}`)
  }
  return lines.join('\n')
}
