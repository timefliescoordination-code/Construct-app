export const VRA_BLOG_JSON_INSTRUCTION = `Generate a VRA Homes blog post as JSON only. No markdown, no commentary, no code fences.

The JSON must match this exact structure:

{
  "type": "blog",
  "title": "string (required)",
  "category": "string (required)",
  "theme": "optional string",
  "part": "optional string, e.g. 01",
  "tagline": "optional string",
  "excerpt": "optional string",
  "slug": "optional kebab-case slug",
  "featured_image": "optional https URL or site path starting with /",
  "sections": []
}

Required root fields: type, title, category, sections.
type must be exactly "blog".
sections is an array of objects. Each section must have a "type" from this allowed list only:
hero, text, highlight, quote, warning, image, image_text, comparison, process, timeline, stats, cost_grid, tip, cta, faq, takeaway, gallery

Do not invent other section types (no charts, html, video, iframe, markdown, or custom widgets).
Do not include HTML, JavaScript, CSS, script tags, iframes, event handlers, or javascript: / data: URLs.
All text must be plain text. Images and links must be http(s) URLs or site paths starting with /.
Do not control CSS. Visual look is decided by variant names only.

Section schemas:

hero
{ "type": "hero", "eyebrow": "optional", "title": "optional", "subtitle": "optional" }

text
{ "type": "text", "heading": "optional", "paragraphs": ["required non-empty strings"] }

highlight
{ "type": "highlight", "variant": "green|note|warning|dark|recommend|error|danger|info", "text": "required" }

quote
{ "type": "quote", "text": "required" }

warning / tip / takeaway
{ "type": "warning|tip|takeaway", "title": "optional", "text": "required" }

image
{ "type": "image", "src": "required URL", "caption": "optional" }

image_text
{ "type": "image_text", "src": "required URL", "position": "left|right", "heading": "optional", "paragraphs": ["..."] }

comparison
{ "type": "comparison", "title": "optional", "items": [{ "title": "required", "text": "required", "variant": "danger|warning|error|green|success|info|default|note" }] }
comparison requires items.

process / timeline
{ "type": "process|timeline", "title": "optional", "tone": "professional|expensive", "steps": ["required non-empty strings"] }
process and timeline require steps.

stats
{ "type": "stats", "items": [{ "label": "required", "value": "required" }] }

cost_grid
{ "type": "cost_grid", "title": "optional", "rows": [{ "item": "", "spec": "", "note": "" }] }

cta
{ "type": "cta", "headline": "optional", "body": "optional", "label": "optional", "href": "optional internal path like /contact" }

faq
{ "type": "faq", "items": [{ "q": "required", "a": "required" }] }

gallery
{ "type": "gallery", "images": ["https://..."] or [{ "src": "required", "caption": "optional" }] }

Write in VRA Homes voice: architecture-led residential construction in Chennai. Practical, calm, specific. Topic for this post: "`

export function buildVraBlogJsonPrompt(topic: string): string {
  const trimmed = topic.replace(/\s+/g, ' ').trim()
  return `${VRA_BLOG_JSON_INSTRUCTION}${trimmed}"`
}
