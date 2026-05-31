import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  className,
  valueClassName,
  variant = "default",
}: {
  title: string
  value: React.ReactNode
  description?: React.ReactNode
  icon?: LucideIcon
  className?: string
  valueClassName?: string
  variant?: "default" | "success" | "warning" | "danger"
}) {
  const variantBorder = {
    default: "border-border",
    success: "border-success/30",
    warning: "border-warning/30",
    danger: "border-destructive/30",
  }[variant]

  const iconColor = {
    default: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[variant]

  return (
    <Card className={cn("card-metric bg-card", variantBorder, className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon ? <Icon className={cn("h-4 w-4 shrink-0", iconColor)} /> : null}
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl",
            valueClassName,
          )}
        >
          {value}
        </div>
        {description != null && description !== "" && (
          <div className="mt-1.5 text-xs text-muted-foreground">{description}</div>
        )}
      </CardContent>
    </Card>
  )
}
