import type { VraBlogPost } from './blog-types.ts'

export function websiteJsonPayload(post: VraBlogPost): string {
  if (!post || post.type !== 'blog') {
    throw new Error('Website JSON must have type "blog"')
  }
  const text = JSON.stringify(post, null, 2)
  const parsed = JSON.parse(text) as VraBlogPost
  if (parsed.type !== 'blog' || !Array.isArray(parsed.sections)) {
    throw new Error('Website JSON is incomplete')
  }
  if (text[0] !== '{') {
    throw new Error('Website JSON must start with {')
  }
  return text
}

export function isWebsiteJsonPayload(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as { type?: unknown; sections?: unknown }
    return parsed?.type === 'blog' && Array.isArray(parsed.sections)
  } catch {
    return false
  }
}
