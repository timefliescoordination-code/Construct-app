import type { UserRole } from '@/lib/types/database'

export function dashboardPath(role: UserRole | null): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'pm':
      return '/pm'
    case 'engineer':
      return '/engineer'
    case 'customer':
      return '/customer'
    default:
      return '/admin'
  }
}
