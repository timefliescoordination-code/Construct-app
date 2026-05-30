import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { createMaterialAlias, recordMaterialPurchase } from '@/lib/data/materials'
import { isRateIncreasedWarning } from '@/lib/materials/constants'
import type { MaterialMappingReview } from '@/lib/types/database'

export async function listPendingMaterialMappingReviews(expenseId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to view mapping reviews.' }
  }

  const { data, error } = await supabase
    .from('material_mapping_reviews')
    .select('*')
    .eq('expense_id', expenseId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  return { data: (data ?? []) as MaterialMappingReview[], error: null }
}

export async function listMaterialsForMapping() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to view materials.' }
  }

  const { data, error } = await supabase
    .from('material_master')
    .select('id, material_name')
    .order('material_name', { ascending: true })

  if (error) {
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  return {
    data: (data ?? []).map((row) => ({
      id: row.id as string,
      materialName: row.material_name as string,
    })),
    error: null,
  }
}

async function refreshExpenseMaterialRateWarning(
  supabase: Awaited<ReturnType<typeof createClient>>,
  expenseId: string,
): Promise<void> {
  const { data: items } = await supabase
    .from('invoice_items')
    .select('material_id')
    .eq('expense_id', expenseId)
    .not('material_id', 'is', null)

  const materialIds = [...new Set((items ?? []).map((item) => item.material_id as string))]
  if (materialIds.length === 0) {
    await supabase.from('expenses').update({ material_rate_warning: false }).eq('id', expenseId)
    return
  }

  const { data: materials } = await supabase
    .from('material_master')
    .select('average_rate, latest_rate')
    .in('id', materialIds)

  const hasWarning = (materials ?? []).some((material) =>
    isRateIncreasedWarning(Number(material.latest_rate), Number(material.average_rate)),
  )

  await supabase
    .from('expenses')
    .update({ material_rate_warning: hasWarning })
    .eq('id', expenseId)
}

export async function mapMaterialReviewToMaster(input: {
  reviewId: string
  materialId: string
  mappedBy: string
}) {
  const supabase = await createClient()

  const { data: review, error: reviewError } = await supabase
    .from('material_mapping_reviews')
    .select('*')
    .eq('id', input.reviewId)
    .eq('status', 'pending')
    .maybeSingle()

  if (reviewError) {
    return { data: null, error: getSupabaseErrorMessage(reviewError) }
  }

  if (!review) {
    return { data: null, error: 'Mapping review not found.' }
  }

  const { data: material, error: materialError } = await supabase
    .from('material_master')
    .select('id, material_name')
    .eq('id', input.materialId)
    .maybeSingle()

  if (materialError || !material) {
    return { data: null, error: materialError?.message ?? 'Material not found.' }
  }

  const aliasResult = await createMaterialAlias({
    materialId: input.materialId,
    aliasName: review.alias_name as string,
  })

  if (aliasResult.error) {
    return { data: null, error: aliasResult.error }
  }

  if (review.invoice_item_id) {
    const { error: itemError } = await supabase
      .from('invoice_items')
      .update({
        material_id: input.materialId,
        material_description_standardized: material.material_name,
      })
      .eq('id', review.invoice_item_id)

    if (itemError) {
      return { data: null, error: getSupabaseErrorMessage(itemError) }
    }

    const { data: invoiceItem } = await supabase
      .from('invoice_items')
      .select('unit_rate, expense_id')
      .eq('id', review.invoice_item_id)
      .maybeSingle()

    if (invoiceItem?.unit_rate && Number(invoiceItem.unit_rate) > 0) {
      const { data: expense } = await supabase
        .from('expenses')
        .select('id, project_id, vendor_name, expense_date')
        .eq('id', invoiceItem.expense_id)
        .maybeSingle()

      if (expense) {
        const { data: invoice } = await supabase
          .from('expense_invoices')
          .select('vendor_name, invoice_date')
          .eq('expense_id', expense.id)
          .maybeSingle()

        await recordMaterialPurchase({
          materialId: input.materialId,
          purchaseRate: Number(invoiceItem.unit_rate),
          projectId: expense.project_id,
          vendorName: (invoice?.vendor_name as string | null) ?? expense.vendor_name,
          purchaseDate:
            (invoice?.invoice_date as string | null) ?? (expense.expense_date as string),
          expenseId: expense.id,
        })
      }
    }
  }

  const { error: resolveError } = await supabase
    .from('material_mapping_reviews')
    .update({
      status: 'mapped',
      mapped_material_id: input.materialId,
      mapped_by: input.mappedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', input.reviewId)

  if (resolveError) {
    return { data: null, error: getSupabaseErrorMessage(resolveError) }
  }

  await refreshExpenseMaterialRateWarning(supabase, review.expense_id as string)

  return { data: true, error: null }
}
