"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

function isTableChunk(chunk: string): boolean {
  const lines = chunk.split("\n").filter((line) => line.trim())
  return lines.length >= 2 && lines.every((line) => line.trim().startsWith("|"))
}

function parseCells(line: string): string[] {
  const trimmed = line.trim()
  const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed
  const withoutTail = inner.endsWith("|") ? inner.slice(0, -1) : inner
  return withoutTail.split("|").map((cell) => cell.trim())
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")))
}

function renderTable(chunk: string, key: string): ReactNode {
  const rows = chunk
    .split("\n")
    .map(parseCells)
    .filter((cells) => cells.length > 0 && !isSeparatorRow(cells))
  if (rows.length === 0) return null
  const [header, ...body] = rows
  return (
    <div key={key} className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[28rem] border-collapse text-sm">
        <thead>
          <tr className="bg-muted/70">
            {header.map((cell, index) => (
              <th
                key={`${key}-h-${index}`}
                className={cn(
                  "border-b border-border px-3 py-2 font-semibold",
                  index === header.length - 1 ? "text-right" : "text-left border-r",
                )}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((cells, rowIndex) => (
            <tr key={`${key}-r-${rowIndex}`}>
              {cells.map((cell, cellIndex) => (
                <td
                  key={`${key}-r-${rowIndex}-c-${cellIndex}`}
                  className={cn(
                    "border-b border-border px-3 py-2",
                    cellIndex === cells.length - 1
                      ? "text-right font-medium tabular-nums"
                      : "border-r",
                    cellIndex === 1 && "text-muted-foreground",
                  )}
                >
                  {cell || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderList(chunk: string, key: string): ReactNode {
  const lines = chunk.split("\n").filter((line) => line.trim())
  const unordered = lines.every((line) => /^\s*-\s+/.test(line))
  const ordered = lines.every((line) => /^\s*\d+\.\s+/.test(line))
  if (!unordered && !ordered) return null
  const items = lines.map((line) => line.replace(/^\s*(?:-\s+|\d+\.\s+)/, ""))
  const List = unordered ? "ul" : "ol"
  return (
    <List
      key={key}
      className={cn(
        "space-y-1 pl-5 text-sm leading-relaxed text-foreground",
        unordered ? "list-disc" : "list-decimal",
      )}
    >
      {items.map((item, index) => (
        <li key={`${key}-${index}`}>{item}</li>
      ))}
    </List>
  )
}

function renderChunk(chunk: string, index: number): ReactNode {
  const key = `md-${index}`
  const trimmed = chunk.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("# ")) {
    return (
      <h1 key={key} className="text-2xl font-semibold tracking-tight text-foreground">
        {trimmed.slice(2).trim()}
      </h1>
    )
  }
  if (trimmed.startsWith("## ")) {
    return (
      <h2 key={key} className="text-lg font-semibold tracking-tight text-foreground">
        {trimmed.slice(3).trim()}
      </h2>
    )
  }
  if (trimmed.startsWith("### ")) {
    return (
      <h3 key={key} className="text-base font-semibold text-foreground">
        {trimmed.slice(4).trim()}
      </h3>
    )
  }
  if (isTableChunk(trimmed)) return renderTable(trimmed, key)
  const list = renderList(trimmed, key)
  if (list) return list
  return (
    <p key={key} className="text-sm leading-relaxed text-muted-foreground">
      {trimmed}
    </p>
  )
}

export function MarketingMarkdownPreview({ markdown }: { markdown: string }) {
  const chunks = markdown
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .filter((chunk) => chunk.trim())
  if (chunks.length === 0) return null
  return (
    <article className="space-y-4">
      {chunks.map((chunk, index) => renderChunk(chunk, index))}
    </article>
  )
}
