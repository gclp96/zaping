export type NavigationItem = {
  label: string;
  href: string;
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
        label: 'Dashboard',
        href: '/dashboard',
      },
    ],
  },
  {
    label: 'COMERCIAL',
    items: [
      {
        label: 'Clientes',
        href: '/customers',
      },
      {
        label: 'Cotizaciones',
        href: '/quotes',
      },
      {
        label: 'Ventas',
        href: '/sales',
      },
    ],
  },
  {
    label: 'COMPRAS',
    items: [
      {
        label: 'Proveedores',
        href: '/suppliers',
      },
      {
        label: 'Compras',
        href: '/purchases',
      },
      {
        label: 'Recepciones',
        href: '/purchase-receipts',
      },
    ],
  },
  {
    label: 'INVENTARIO',
    items: [
      {
        label: 'Productos',
        href: '/products',
      },
      {
        label: 'Inventario',
        href: '/inventory',
      },
      {
        label: 'Equipos',
        href: '/equipment',
      },
    ],
  },
  {
    label: 'ADMINISTRACIÓN',
    items: [
      {
        label: 'Categorías',
        href: '/categories',
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
