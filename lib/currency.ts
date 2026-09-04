// Indian Rupee currency formatting utility

export const formatINR = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Exact rupees for internal expense screens. Keeps paise when present. */
export const formatINRDetailed = (amount: number): string => {
  const n = Number(amount)
  const value = Number.isFinite(n) ? n : 0
  const paise = Math.round(Math.abs(value) * 100) % 100
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export const formatINRCompact = (amount: number): string => {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`
  } else if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`
  }
  return `₹${amount.toLocaleString("en-IN")}`
}

export const parseINR = (value: string): number => {
  return parseFloat(value.replace(/[₹,]/g, "")) || 0
}
