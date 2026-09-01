import type { User, UserRole } from "./types";

export const userRoleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "ADMIN", label: "Administrador" },
  { value: "MANAGER", label: "Gerente" },
  { value: "SALES", label: "Ventas" },
  { value: "WAREHOUSE", label: "Almacén" },
];

export const userRoleLabels: Record<UserRole, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  SALES: "Ventas",
  WAREHOUSE: "Almacén",
};

export function getUserFullName(user: Pick<User, "firstName" | "lastName">) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
}

export function getUserRoleLabel(role: UserRole) {
  return userRoleLabels[role];
}

export function userMatchesSearch(user: User, search: string): boolean {
  const normalizedSearch = search.trim().toLocaleLowerCase("es-MX");

  if (!normalizedSearch) {
    return true;
  }

  return [
    user.firstName,
    user.lastName,
    getUserFullName(user),
    user.email,
  ].some((value) =>
    value.toLocaleLowerCase("es-MX").includes(normalizedSearch),
  );
}
