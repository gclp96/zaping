import {
  Boxes,
  ClipboardList,
  FileText,
  House,
  LayoutDashboard,
  Package,
  PackageCheck,
  ShoppingCart,
  Tags,
  Truck,
  UsersRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const navigationGroups: NavigationGroup[] = [
  {
    label: 'INICIO',
    items: [
      {
        label: 'Inicio',
        href: '/home',
        icon: House,
      },
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: 'COMERCIAL',
    items: [
      {
        label: 'Clientes',
        href: '/customers',
        icon: UsersRound,
      },
      {
        label: 'Cotizaciones',
        href: '/quotes',
        icon: FileText,
      },
      {
        label: 'Ventas',
        href: '/sales',
        icon: ShoppingCart,
      },
    ],
  },
  {
    label: 'COMPRAS',
    items: [
      {
        label: 'Proveedores',
        href: '/suppliers',
        icon: Truck,
      },
      {
        label: 'Compras',
        href: '/purchases',
        icon: ClipboardList,
      },
      {
        label: 'Recepciones',
        href: '/purchase-receipts',
        icon: PackageCheck,
      },
    ],
  },
  {
    label: 'INVENTARIO',
    items: [
      {
        label: 'Productos',
        href: '/products',
        icon: Package,
      },
      {
        label: 'Inventario',
        href: '/inventory',
        icon: Boxes,
      },
      {
        label: 'Equipos',
        href: '/equipment',
        icon: Wrench,
      },
    ],
  },
  {
    label: 'ADMINISTRACIÓN',
    items: [
      {
        label: 'Categorías',
        href: '/categories',
        icon: Tags,
      },
    ],
  },
];

export function isNavigationItemActive(
  pathname: string,
  href: string,
): boolean {
  if (href === '/') {
    return pathname === '/';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
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

  return 'Zaping ERP';
}
