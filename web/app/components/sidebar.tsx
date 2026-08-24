'use client';

import Link from 'next/link';

import {
  isNavigationItemActive,
  navigationGroups,
} from '@/app/components/navigation';

type SidebarProps = {
  pathname: string;
  className?: string;
  onNavigate?: () => void;
  showCloseButton?: boolean;
  onClose?: () => void;
};

export default function Sidebar({
  pathname,
  className = '',
  onNavigate,
  showCloseButton = false,
  onClose,
}: SidebarProps) {
  return (
    <aside
      className={`min-h-screen w-64 flex-col overflow-y-auto bg-slate-900 p-6 text-white ${className}`}
    >
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Zaping ERP</h1>

        {showCloseButton ? (
          <button
            type="button"
            aria-label="Cerrar navegación"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 text-white transition hover:bg-white/10"
            onClick={onClose}
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              ×
            </span>
          </button>
        ) : null}
      </div>

      <nav
        className="mt-10 space-y-8"
        aria-label="Navegación principal"
      >
        {navigationGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {group.label}
            </p>

            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const active = isNavigationItemActive(
                  pathname,
                  item.href,
                );

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-lg px-3 py-2 text-base font-medium transition ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-200 hover:bg-white/10 hover:text-white'
                    }`}
                    onClick={onNavigate}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
