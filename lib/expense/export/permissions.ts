import type { UserRole } from '../../types/database.ts'

export function canExportExpenses(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'pm' || role === 'engineer'
}

export function canExportCompanyPersonal(role: UserRole | null | undefined): boolean {
  return role === 'admin'
}
