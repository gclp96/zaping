import {
  Boxes,
  ClipboardList,
  FileText,
  House,
  KeyRound,
  LayoutDashboard,
  Package,
  PackageCheck,
  ShoppingCart,
  Tags,
  Truck,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/app/auth-session";

export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  visibleForRoles?: readonly UserRole[];
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const navigationGroups: NavigationGroup[] = [
  {
    label: "INICIO",
    items: [
      {
        label: "Inicio",
        href: "/home",
        icon: House,
      },
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        label: "Cambiar contraseña",
        href: "/change-password",
        icon: KeyRound,
      },
    ],
  },
  {
    label: "COMERCIAL",
    items: [
      {
        label: "Clientes",
        href: "/customers",
        icon: UsersRound,
      },
      {
        label: "Cotizaciones",
        href: "/quotes",
        icon: FileText,
      },
      {
        label: "Ventas",
        href: "/sales",
        icon: ShoppingCart,
      },
    ],
  },
  {
    label: "COMPRAS",
    items: [
      {
        label: "Proveedores",
        href: "/suppliers",
        icon: Truck,
      },
      {
        label: "Compras",
        href: "/purchases",
        icon: ClipboardList,
      },
      {
        label: "Recepciones",
        href: "/purchase-receipts",
        icon: PackageCheck,
      },
    ],
  },
  {
    label: "INVENTARIO",
    items: [
      {
        label: "Productos",
        href: "/products",
        icon: Package,
      },
      {
        label: "Inventario",
        href: "/inventory",
        icon: Boxes,
      },
      {
        label: "Equipos",
        href: "/equipment",
        icon: Wrench,
      },
    ],
  },
  {
    label: "ADMINISTRACIÓN",
    items: [
      {
        label: "Usuarios",
        href: "/users",
        icon: UsersRound,
        visibleForRoles: ["ADMIN"],
      },
      {
        label: "Categorías",
        href: "/categories",
        icon: Tags,
      },
    ],
  },
];

export function isNavigationItemActive(
  pathname: string,
  href: string,
): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getVisibleNavigationGroups(
  currentUserRole?: UserRole | null,
): NavigationGroup[] {
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !item.visibleForRoles ||
          Boolean(
            currentUserRole && item.visibleForRoles.includes(currentUserRole),
          ),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

export function getRouteTitle(pathname: string): string {
  for (const group of navigationGroups) {
    const activeItem = group.items.find((item) =>
      isNavigationItemActive(pathname, item.href),
    );

    if (activeItem) {
      return activeItem.label;
    }
  }

  return "Zaping ERP";
}
