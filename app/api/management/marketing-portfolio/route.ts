import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/require-admin'
import { buildMarketingPortfolio } from '@/lib/marketing/build-case-study'
import { loadRawProjectsForMarketing } from '@/lib/marketing/load-portfolio'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'

export async function GET() {
  try {
    const auth = await requireAdminApi()
    if ('error' in auth) {
      return auth.error
    }

    const { supabase } = auth
    const rawProjects = await loadRawProjectsForMarketing(supabase)
    const items = buildMarketingPortfolio(rawProjects)

    return NextResponse.json({
      items: items.map((item) => ({
        internalId: item.internalId,
        internalName: item.internalName,
        status: item.status,
        recognitionRisk: item.recognitionRisk,
        bands: item.bands,
        markdown: item.markdown,
        blogJson: item.blogJson,
        jsonPrompt: item.jsonPrompt,
        copySafe: item.copySafe,
        privacyIssues: item.privacyIssues,
        spendMix: item.spendMix,
        expenseSheet: item.expenseSheet,
        expenseLines: item.expenseLines,
        subcategories: item.subcategories,
      })),
    })
  } catch (error) {
    console.error('[admin/marketing-portfolio] query error:', error)
    return NextResponse.json({ error: getSupabaseErrorMessage(error) }, { status: 500 })
  }
}
