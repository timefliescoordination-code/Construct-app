"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

const DEFAULT_LOGO = "/images/vra-logo.png"

export function BrandLogo({
  src,
  alt = "VRA HOMES",
  size = 36,
  className,
}: {
  src?: string | null
  alt?: string
  size?: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const resolvedSrc = failed ? DEFAULT_LOGO : src || DEFAULT_LOGO

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-xl bg-muted shadow-sm",
        className,
      )}
      style={{ width: size, height: size, minWidth: size, minHeight: size, maxWidth: size, maxHeight: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- sized brand mark, not layout photo */}
      <img
        src={resolvedSrc}
        alt={alt}
        width={size}
        height={size}
        onError={() => {
          if (resolvedSrc !== DEFAULT_LOGO) setFailed(true)
        }}
        onLoad={(event) => {
          const img = event.currentTarget
          // #region agent log
          fetch('http://127.0.0.1:7406/ingest/d702b43b-4e46-403e-a16b-cd4a4de78fb9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b15f8a'},body:JSON.stringify({sessionId:'b15f8a',runId:'post-fix',hypothesisId:'E',location:'components/layout/brand-logo.tsx:onLoad',message:'brand logo painted',data:{src:resolvedSrc,size,naturalWidth:img.naturalWidth,clientWidth:img.clientWidth,parentWidth:img.parentElement?.clientWidth??null,href:typeof window==='undefined'?null:window.location.pathname},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        }}
        className="block h-full w-full object-cover"
        style={{ width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%", objectFit: "cover" }}
      />
    </span>
  )
}
