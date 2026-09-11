import type { UserRole } from '@/app/auth-session';

export const ALL_ROLES: readonly UserRole[] = [
  'ADMIN',
  'MANAGER',
  'SALES',
  'WAREHOUSE',
];

export const MANAGEMENT_ROLES: readonly UserRole[] = ['ADMIN', 'MANAGER'];
export const COMMERCIAL_ROLES: readonly UserRole[] = [
  'ADMIN',
  'MANAGER',
  'SALES',
];
export const WAREHOUSE_ROLES: readonly UserRole[] = [
  'ADMIN',
  'MANAGER',
  'WAREHOUSE',
];
export const HEALTHCARE_MASTER_EDIT_ROLES = COMMERCIAL_ROLES;
export const HEALTHCARE_MASTER_LIFECYCLE_ROLES = MANAGEMENT_ROLES;

export function hasRole(
  role: UserRole | null | undefined,
  allowedRoles: readonly UserRole[],
): boolean {
  return Boolean(role && allowedRoles.includes(role));
}

export function canManageCatalog(role: UserRole | null | undefined): boolean {
  return hasRole(role, MANAGEMENT_ROLES);
}

export function canManageCustomers(role: UserRole | null | undefined): boolean {
  return hasRole(role, COMMERCIAL_ROLES);
}

export function canManageSuppliers(role: UserRole | null | undefined): boolean {
  return hasRole(role, WAREHOUSE_ROLES);
}

export function canEditPurchases(role: UserRole | null | undefined): boolean {
  return hasRole(role, WAREHOUSE_ROLES);
}

export function canApprovePurchases(role: UserRole | null | undefined): boolean {
  return hasRole(role, MANAGEMENT_ROLES);
}

export function canManageInventory(role: UserRole | null | undefined): boolean {
  return hasRole(role, WAREHOUSE_ROLES);
}

export function canAdjustInventory(role: UserRole | null | undefined): boolean {
  return hasRole(role, MANAGEMENT_ROLES);
}

export function canManageCommercial(
  role: UserRole | null | undefined,
): boolean {
  return hasRole(role, COMMERCIAL_ROLES);
}

export function canManageEquipment(role: UserRole | null | undefined): boolean {
  return hasRole(role, WAREHOUSE_ROLES);
}

export function canEditHealthcareMasters(
  role: UserRole | null | undefined,
): boolean {
  return hasRole(role, HEALTHCARE_MASTER_EDIT_ROLES);
}

export function canManageHealthcareMasterLifecycle(
  role: UserRole | null | undefined,
): boolean {
  return hasRole(role, HEALTHCARE_MASTER_LIFECYCLE_ROLES);
}
