"use client"

import { useState } from "react"
import type {
  ComparisonVariant,
  HighlightVariant,
  VraBlogPost,
  VraBlogSection,
} from "@/lib/marketing/blog-types"
import { COST_GRID_VISIBLE_ROWS } from "@/lib/marketing/blog-limits"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const HIGHLIGHT_CLASS: Record<HighlightVariant, string> = {
  green: "border-l-emerald-500 bg-emerald-500/10 text-foreground",
  note: "border-l-sky-500 bg-sky-500/10 text-foreground",
  warning: "border-l-amber-500 bg-amber-500/10 text-foreground",
  dark: "border-l-foreground bg-foreground text-background",
  recommend: "border-l-primary bg-primary/10 text-foreground",
  error: "border-l-destructive bg-destructive/10 text-foreground",
  danger: "border-l-destructive bg-destructive/10 text-foreground",
  info: "border-l-sky-400 bg-muted text-foreground",
}

const COMPARE_CLASS: Record<ComparisonVariant, string> = {
  danger: "border-destructive/40 bg-destructive/5",
  warning: "border-amber-500/40 bg-amber-500/10",
  error: "border-destructive/40 bg-destructive/5",
  green: "border-emerald-500/40 bg-emerald-500/10",
  success: "border-emerald-500/40 bg-emerald-500/10",
  info: "border-sky-500/40 bg-sky-500/10",
  default: "border-border bg-card",
  note: "border-primary/30 bg-primary/5",
}

function Paragraphs({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-[15px] leading-7 text-muted-foreground">
          {paragraph}
        </p>
      ))}
    </div>
  )
}

function galleryItems(
  images: string[] | Array<{ src: string; caption?: string }>,
): Array<{ src: string; caption?: string }> {
  return images.map((image) => (typeof image === "string" ? { src: image } : image))
}

function BlogImage({ src, caption, className }: { src: string; caption?: string; className?: string }) {
  return (
    <figure className={cn("overflow-hidden rounded-xl border border-border bg-muted/30", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={caption || "Project photo"} className="h-auto w-full object-cover" />
      {caption ? (
        <figcaption className="px-3 py-2 text-xs text-muted-foreground">{caption}</figcaption>
      ) : null}
    </figure>
  )
}

function CostGridSection({
  section,
}: {
  section: Extract<VraBlogSection, { type: "cost_grid" }>
}) {
  const [expanded, setExpanded] = useState(false)
  const hidden = Math.max(0, section.rows.length - COST_GRID_VISIBLE_ROWS)
  const visible = expanded ? section.rows : section.rows.slice(0, COST_GRID_VISIBLE_ROWS)

  return (
    <section className="space-y-3">
      {section.title ? (
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{section.title}</h2>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="bg-foreground text-background">
              <th className="px-3 py-2.5 text-left font-semibold">Category</th>
              <th className="px-3 py-2.5 text-left font-semibold">Description</th>
              <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, rowIndex) => (
              <tr key={`${row.item}-${rowIndex}`} className="odd:bg-background even:bg-muted/40">
                <td className="px-3 py-2 align-top font-medium">{row.item}</td>
                <td className="px-3 py-2 align-top text-muted-foreground">{row.spec || "—"}</td>
                <td className="px-3 py-2 align-top text-right tabular-nums">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hidden > 0 ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Show less" : `Read more · ${hidden} more rows`}
        </Button>
      ) : null}
    </section>
  )
}

function renderSection(section: VraBlogSection, index: number) {
  switch (section.type) {
    case "hero":
      return (
        <header key={index} className="space-y-3 border-b border-border pb-8">
          {section.eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              {section.eyebrow}
            </p>
          ) : null}
          {section.title ? (
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {section.title}
            </h1>
          ) : null}
          {section.subtitle ? (
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">{section.subtitle}</p>
          ) : null}
        </header>
      )
    case "text":
      return (
        <section key={index} className="space-y-3">
          {section.heading ? (
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{section.heading}</h2>
          ) : null}
          <Paragraphs paragraphs={section.paragraphs} />
        </section>
      )
    case "highlight":
      return (
        <aside
          key={index}
          className={cn("rounded-r-xl border-l-4 px-4 py-3 text-sm leading-6", HIGHLIGHT_CLASS[section.variant])}
        >
          {section.text}
        </aside>
      )
    case "quote":
      return (
        <blockquote
          key={index}
          className="border-l-4 border-primary pl-5 text-lg font-medium leading-8 text-foreground"
        >
          {section.text}
        </blockquote>
      )
    case "warning":
    case "tip":
    case "takeaway":
      return (
        <section
          key={index}
          className={cn(
            "rounded-xl border px-4 py-4",
            section.type === "warning" && "border-amber-500/40 bg-amber-500/10",
            section.type === "tip" && "border-emerald-500/30 bg-emerald-500/10",
            section.type === "takeaway" && "border-border bg-muted/40",
          )}
        >
          {section.title ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{section.title}</p>
          ) : null}
          <p className={cn("text-sm leading-6 text-foreground", section.title && "mt-1.5")}>{section.text}</p>
        </section>
      )
    case "comparison":
      return (
        <section key={index} className="space-y-3">
          {section.title ? (
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{section.title}</h2>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {section.items.map((item) => (
              <article
                key={item.title}
                className={cn("rounded-xl border p-4", COMPARE_CLASS[item.variant ?? "default"])}
              >
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </article>
            ))}
          </div>
        </section>
      )
    case "process":
    case "timeline":
      return (
        <section key={index} className="space-y-4">
          {section.title ? (
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{section.title}</h2>
          ) : null}
          <ol className="space-y-0">
            {section.steps.map((step, stepIndex) => (
              <li key={`${step}-${stepIndex}`} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                    {stepIndex + 1}
                  </span>
                  {stepIndex < section.steps.length - 1 ? (
                    <span className="w-px flex-1 bg-border" />
                  ) : null}
                </div>
                <p className="pb-6 pt-1.5 text-sm leading-6 text-foreground">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      )
    case "stats":
      return (
        <section key={index} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {section.items.map((item) => (
            <article key={item.label} className="rounded-xl border border-border bg-card px-4 py-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-2 text-sm font-semibold leading-5 text-foreground">{item.value}</p>
            </article>
          ))}
        </section>
      )
    case "cost_grid":
      return <CostGridSection key={index} section={section} />
    case "faq":
      return (
        <section key={index} className="space-y-3">
          <div className="divide-y divide-border rounded-xl border border-border">
            {section.items.map((item) => (
              <article key={item.q} className="px-4 py-4">
                <p className="text-sm font-semibold text-foreground">{item.q}</p>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.a}</p>
              </article>
            ))}
          </div>
        </section>
      )
    case "cta":
      return (
        <section key={index} className="rounded-2xl bg-foreground px-5 py-6 text-background sm:px-8">
          {section.headline ? (
            <p className="text-xl font-semibold tracking-tight">{section.headline}</p>
          ) : null}
          {section.body ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-background/80">{section.body}</p>
          ) : null}
          {section.label ? (
            <p className="mt-4 inline-flex rounded-full bg-background px-4 py-2 text-sm font-medium text-foreground">
              {section.href ? `${section.label} · ${section.href}` : section.label}
            </p>
          ) : null}
        </section>
      )
    case "image":
      return <BlogImage key={index} src={section.src} caption={section.caption} />
    case "image_text":
      return (
        <section
          key={index}
          className={cn(
            "grid gap-6 sm:grid-cols-2 sm:items-center",
            section.position === "left" && "sm:[&>figure]:order-first",
          )}
        >
          <div className="space-y-3">
            {section.heading ? (
              <h2 className="text-xl font-semibold tracking-tight text-foreground">{section.heading}</h2>
            ) : null}
            {section.paragraphs?.length ? <Paragraphs paragraphs={section.paragraphs} /> : null}
          </div>
          <BlogImage src={section.src} caption={section.heading} />
        </section>
      )
    case "gallery":
      return (
        <section key={index} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {galleryItems(section.images).map((image) => (
            <BlogImage key={image.src} src={image.src} caption={image.caption} />
          ))}
        </section>
      )
    default:
      return null
  }
}

export function MarketingBlogPreview({ post }: { post: VraBlogPost }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="border-b border-border bg-muted/30 px-5 py-4 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {post.category}
          {post.theme ? ` · ${post.theme}` : ""}
        </p>
        {post.tagline ? (
          <p className="mt-1 text-sm text-muted-foreground">{post.tagline}</p>
        ) : null}
      </div>
      <div className="space-y-8 px-5 py-8 sm:px-8">
        {post.excerpt ? (
          <p className="text-base leading-7 text-foreground">{post.excerpt}</p>
        ) : null}
        {post.sections.map((section, index) => renderSection(section, index))}
      </div>
    </article>
  )
}
