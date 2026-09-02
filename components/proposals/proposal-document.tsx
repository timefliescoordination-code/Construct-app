'use client'

import type { ReactNode } from 'react'
import { format } from 'date-fns'
import { BrandLogo } from '@/components/layout/brand-logo'
import { ScrollTable } from '@/components/layout/scroll-table'
import { formatINR } from '@/lib/currency'
import { formatAreaRateDisplay, formatBoqLineDisplay } from '@/lib/proposals/calculations'
import { boqSerialLabel, isChildRow, isHeading } from '@/lib/proposals/boq-structure'
import { PROPOSAL_METHOD_LABELS, formatProposalNumber } from '@/lib/proposals/constants'
import type { PublicProposalDocument, PublicProposalItem } from '@/lib/proposals/types'
import { cn } from '@/lib/utils'

function itemsFor(doc: PublicProposalDocument, section: PublicProposalItem['section']) {
  return doc.items.filter((item) => item.section === section).sort((a, b) => a.sort_order - b.sort_order)
}

function ProposalTable({
  items,
  showQtyColumn,
}: {
  items: PublicProposalItem[]
  showQtyColumn?: boolean
}) {
  if (items.length === 0) return null

  return (
    <ScrollTable minWidth="min-w-[32rem]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            <th className="py-2 pr-3 font-semibold">S.No</th>
            <th className="py-2 pr-3 font-semibold">Description</th>
            <th className="py-2 pr-3 font-semibold">{showQtyColumn ? 'Quantity / Rate' : 'Area / Unit Rate'}</th>
            <th className="py-2 text-right font-semibold">Price</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const heading = isHeading(item)
            const child = isChildRow(items, index)
            const serial = showQtyColumn ? boqSerialLabel(items, index, item.section) : String(index + 1)
            return (
              <tr
                key={`${item.section}-${item.sort_order}-${index}`}
                className={cn('border-b border-neutral-100', heading && 'bg-neutral-50')}
              >
                <td className="py-3 pr-3 align-top text-neutral-500">{serial}</td>
                <td
                  className={cn(
                    'py-3 pr-3 align-top font-medium text-neutral-900',
                    child && 'pl-6',
                    heading && 'font-semibold',
                  )}
                >
                  {item.description}
                </td>
                <td className="py-3 pr-3 align-top text-neutral-600">
                  {heading
                    ? null
                    : showQtyColumn
                      ? formatBoqLineDisplay(item, formatINR)
                      : formatAreaRateDisplay(item.quantity, item.unit, item.rate, formatINR)}
                </td>
                <td className="py-3 text-right align-top font-medium tabular-nums text-neutral-900">
                  {heading ? null : formatINR(item.price)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ScrollTable>
  )
}

export function ProposalDocumentView({
  document,
  className,
  historicalBanner,
}: {
  document: PublicProposalDocument
  className?: string
  historicalBanner?: ReactNode
}) {
  const builtUp = itemsFor(document, 'built_up')
  const additional = itemsFor(document, 'additional')
  const boq = itemsFor(document, 'boq')

  return (
    <article
      className={cn(
        'mx-auto w-full max-w-3xl bg-white text-neutral-900 print:max-w-none',
        className,
      )}
    >
      <header className="border-b border-neutral-200 pb-8">
        <div className="flex items-start gap-4">
          <BrandLogo
            src={document.company.logo_url}
            alt={document.company.company_name ?? 'VRA HOMES'}
            size={56}
            className="rounded-2xl"
          />
          <div className="min-w-0">
            <p className="text-lg font-bold tracking-tight">
              {document.company.company_name || 'VRA HOMES'}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Construction Proposal
            </p>
          </div>
        </div>
      </header>

      {historicalBanner}

      <div className="py-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{document.project_name}</h1>
        {document.project_address ? (
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-600">
            {document.project_address}
          </p>
        ) : null}
        {document.client_name ? (
          <p className="mt-2 text-sm text-neutral-600">
            Prepared for <span className="font-medium text-neutral-900">{document.client_name}</span>
          </p>
        ) : null}

        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Proposal</dt>
            <dd className="mt-1 font-medium">
              #{formatProposalNumber(document.proposal_number, document.version_number)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Date</dt>
            <dd className="mt-1 font-medium">
              {format(new Date(document.proposal_date), 'd MMM yyyy')}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Method</dt>
            <dd className="mt-1 font-medium">{PROPOSAL_METHOD_LABELS[document.method]}</dd>
          </div>
          {document.valid_until ? (
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Valid until
              </dt>
              <dd className="mt-1 font-medium">
                {format(new Date(document.valid_until), 'd MMM yyyy')}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      {document.method === 'sqft' ? (
        <div className="space-y-10">
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-neutral-500">
              As per built-up area
            </h2>
            <ProposalTable items={builtUp} />
            <p className="mt-3 text-right text-sm text-neutral-600">
              Built-up area total{' '}
              <span className="font-semibold text-neutral-900">{formatINR(document.built_up_total)}</span>
            </p>
          </section>
          {additional.length > 0 ? (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-neutral-500">
                Additional works
              </h2>
              <ProposalTable items={additional} />
              <p className="mt-3 text-right text-sm text-neutral-600">
                Additional works total{' '}
                <span className="font-semibold text-neutral-900">
                  {formatINR(document.additional_works_total)}
                </span>
              </p>
            </section>
          ) : null}
        </div>
      ) : (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-neutral-500">BOQ</h2>
          <ProposalTable items={boq} showQtyColumn />
          <p className="mt-3 text-right text-sm text-neutral-600">
            Total BOQ value{' '}
            <span className="font-semibold text-neutral-900">{formatINR(document.grand_total)}</span>
          </p>
        </section>
      )}

      <div className="mt-10 rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
          Total proposal value
        </p>
        <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
          {formatINR(document.grand_total)}
        </p>
      </div>

      {document.notes.trim() ? (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Notes
          </h2>
          <div className="whitespace-pre-line text-sm leading-relaxed text-neutral-600">
            {document.notes}
          </div>
        </section>
      ) : null}
    </article>
  )
}
