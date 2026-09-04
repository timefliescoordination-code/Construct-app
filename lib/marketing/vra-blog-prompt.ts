import { formatBlogImagePromptNote } from './blog-images.ts'

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

Write in a human voice — a Chennai architect talking to a new homeowner over tea. Warm, specific, never like a policy document or an AI system.
Use Crore for house scale (1.2 Cr residence). Never write 100 lakh, ₹100–200 lakh, or 1 Cr to 2 Cr ranges.
For a new homeowner, show what a project of this scale actually requires.
SEO (required):
- Primary search phrase: house construction cost in Chennai. Use it naturally in the title, first paragraph, one H2, and the slug. Do not stuff.
- category: "House construction". theme: "House construction cost in Chennai".
- title: 50–60 characters. Front-load the Crore scale and Chennai. Example shape: "0.5 Cr house construction cost in Chennai".
- excerpt: 150–160 characters. This is the Google meta description. One clear promise, no fluff.
- slug: kebab-case, include house-construction-cost-chennai plus the Crore figure. No stop words like "a" or "the" if they add nothing.
- hero.title must equal the root title (one H1).
- text.heading values are H2s: write them as questions or phrases people search (cost breakdown, construction stages, how long it takes).
- faq: 5–6 items. Must include "How much does it cost to build a house in Chennai?" and "How long does it take to build a house in Chennai?". Answers 40–70 words, specific to this house.
- Image captions: short and descriptive (house construction in Chennai / design drawing). Never a file name.
- cta href stays /contact.
- Do not invent reviews, star ratings, years, street names, or fake statistics.
cost_grid rows: item = category, spec = subcategory plus the expense description, note = amount.
Show the first 30 cost_grid rows in the published table; a Read more control reveals the rest.
If image URLs are listed after this topic, set featured_image and add image_text plus gallery. If none are listed, omit those sections — do not invent photos. When Design-tab drawings or site photos are added to the project, those slots fill automatically.
Topic for this post: "`

export function buildVraBlogJsonPrompt(topic: string, imageNote?: string): string {
  const trimmed = topic.replace(/\s+/g, ' ').trim()
  const extra = (imageNote ?? formatBlogImagePromptNote([])).trim()
  return `${VRA_BLOG_JSON_INSTRUCTION}${trimmed}"\n\n${extra}`
}
