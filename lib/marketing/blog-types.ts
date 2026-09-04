export const VRA_BLOG_SECTION_TYPES = [
  'hero',
  'text',
  'highlight',
  'quote',
  'warning',
  'image',
  'image_text',
  'comparison',
  'process',
  'timeline',
  'stats',
  'cost_grid',
  'tip',
  'cta',
  'faq',
  'takeaway',
  'gallery',
] as const

export type VraBlogSectionType = (typeof VRA_BLOG_SECTION_TYPES)[number]

export type HighlightVariant =
  | 'green'
  | 'note'
  | 'warning'
  | 'dark'
  | 'recommend'
  | 'error'
  | 'danger'
  | 'info'

export type ComparisonVariant =
  | 'danger'
  | 'warning'
  | 'error'
  | 'green'
  | 'success'
  | 'info'
  | 'default'
  | 'note'

export type ImageTextPosition = 'left' | 'right'
export type ProcessTone = 'professional' | 'expensive'

export type VraBlogSection =
  | { type: 'hero'; eyebrow?: string; title?: string; subtitle?: string }
  | { type: 'text'; heading?: string; paragraphs: string[] }
  | { type: 'highlight'; variant: HighlightVariant; text: string }
  | { type: 'quote'; text: string }
  | { type: 'warning'; title?: string; text: string }
  | { type: 'tip'; title?: string; text: string }
  | { type: 'takeaway'; title?: string; text: string }
  | { type: 'image'; src: string; caption?: string }
  | {
      type: 'image_text'
      src: string
      position: ImageTextPosition
      heading?: string
      paragraphs?: string[]
    }
  | {
      type: 'comparison'
      title?: string
      items: Array<{ title: string; text: string; variant?: ComparisonVariant }>
    }
  | { type: 'process'; title?: string; tone?: ProcessTone; steps: string[] }
  | { type: 'timeline'; title?: string; tone?: ProcessTone; steps: string[] }
  | { type: 'stats'; items: Array<{ label: string; value: string }> }
  | {
      type: 'cost_grid'
      title?: string
      rows: Array<{ item: string; spec: string; note: string }>
    }
  | { type: 'cta'; headline?: string; body?: string; label?: string; href?: string }
  | { type: 'faq'; items: Array<{ q: string; a: string }> }
  | {
      type: 'gallery'
      images: string[] | Array<{ src: string; caption?: string }>
    }

export type VraBlogPost = {
  type: 'blog'
  title: string
  category: string
  theme?: string
  part?: string
  tagline?: string
  excerpt?: string
  slug?: string
  featured_image?: string
  sections: VraBlogSection[]
}
