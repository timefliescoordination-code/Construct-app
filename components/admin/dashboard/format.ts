import { formatINR } from "@/lib/currency"

export function formatSignedINR(amount: number): string {
  const formatted = formatINR(Math.abs(amount))
  if (amount > 0) return `+${formatted}`
  if (amount < 0) return `-${formatted}`
  return formatted
}
