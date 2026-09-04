import { Metadata } from 'next'
import { MarketingPortfolioContent } from '@/components/admin/marketing-portfolio-content'

export const metadata: Metadata = {
  title: 'Marketing Case Studies | VRA HOMES',
  description: 'Convert project data into privacy-preserving construction case studies for marketing content.',
}

export default function AdminMarketingPage() {
  return <MarketingPortfolioContent />
}
