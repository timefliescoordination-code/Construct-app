"use client"

import { format } from "date-fns"
import { formatINR } from "@/lib/currency"

export type ClientPaymentPrintRow = {
  stage_name: string
  amount: number
  received_date: string | null
  due_date: string | null
  payment_method: string | null
  status: string
  notes?: string | null
}

export type ClientPaymentsPrintSheetProps = {
  projectName: string
  clientName: string
  siteAddress?: string | null
  contractValue?: number | null
  payments: ClientPaymentPrintRow[]
  totalReceived: number
  totalPending: number
}

function formatPaymentDate(
  received: string | null,
  due: string | null,
): string {
  const value = received ?? due
  if (!value) return "—"
  try {
    return format(new Date(value), "dd MMM yyyy")
  } catch {
    return value
  }
}

function statusLabel(status: string): string {
  if (status === "received") return "Received"
  if (status === "overdue") return "Overdue"
  return "Pending"
}

export function ClientPaymentsPrintSheet({
  projectName,
  clientName,
  siteAddress,
  contractValue,
  payments,
  totalReceived,
  totalPending,
}: ClientPaymentsPrintSheetProps) {
  const printedAt = format(new Date(), "dd MMM yyyy, h:mm a")
  const totalScheduled = payments.reduce((sum, row) => sum + Number(row.amount), 0)

  return (
    <div
      id="client-payments-print-root"
      className="hidden bg-white text-black print:block"
      aria-hidden
    >
      <div className="mx-auto max-w-[210mm] p-8 text-[11pt] leading-snug text-black">
        <header className="border-b border-black/20 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-black/60">
                VRA HOMES
              </p>
              <h1 className="mt-1 text-xl font-bold">Client Payment Statement</h1>
            </div>
            <p className="text-right text-xs text-black/60">Printed {printedAt}</p>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <p className="text-xs uppercase text-black/50">Project</p>
            <p className="font-semibold">{projectName}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-black/50">Client</p>
            <p className="font-semibold">{clientName}</p>
          </div>
          {siteAddress ? (
            <div className="col-span-2">
              <p className="text-xs uppercase text-black/50">Site</p>
              <p>{siteAddress}</p>
            </div>
          ) : null}
          {contractValue != null && contractValue > 0 ? (
            <div>
              <p className="text-xs uppercase text-black/50">Contract value</p>
              <p className="font-semibold">{formatINR(contractValue)}</p>
            </div>
          ) : null}
        </section>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-2 pr-2 text-left font-semibold">#</th>
              <th className="py-2 pr-2 text-left font-semibold">Stage</th>
              <th className="py-2 pr-2 text-right font-semibold">Amount</th>
              <th className="py-2 pr-2 text-left font-semibold">Date</th>
              <th className="py-2 pr-2 text-left font-semibold">Mode</th>
              <th className="py-2 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment, index) => (
              <tr key={`${payment.stage_name}-${index}`} className="border-b border-black/10">
                <td className="py-2 pr-2 align-top">{index + 1}</td>
                <td className="py-2 pr-2 align-top font-medium">{payment.stage_name}</td>
                <td className="py-2 pr-2 align-top text-right tabular-nums">
                  {formatINR(Number(payment.amount))}
                </td>
                <td className="py-2 pr-2 align-top">
                  {formatPaymentDate(payment.received_date, payment.due_date)}
                </td>
                <td className="py-2 pr-2 align-top">{payment.payment_method ?? "—"}</td>
                <td className="py-2 align-top">{statusLabel(payment.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-6 ml-auto w-full max-w-xs space-y-2 border-t border-black pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <span>Total scheduled</span>
            <span className="font-semibold tabular-nums">{formatINR(totalScheduled)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Total received</span>
            <span className="font-semibold tabular-nums">{formatINR(totalReceived)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Pending / due</span>
            <span className="font-semibold tabular-nums">{formatINR(totalPending)}</span>
          </div>
        </section>

        <footer className="mt-10 border-t border-black/10 pt-4 text-xs text-black/50">
          <p>
            This statement lists client payments recorded in the project dashboard. Use your
            browser&apos;s print dialog and choose &quot;Save as PDF&quot; to export.
          </p>
        </footer>
      </div>
    </div>
  )
}
