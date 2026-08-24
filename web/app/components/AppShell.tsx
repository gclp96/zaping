'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import Header from '@/app/components/Header';
import { getRouteTitle } from '@/app/components/navigation';
import Sidebar from '@/app/components/sidebar';

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavigationOpen, setMobileNavigationOpen] =
    useState(false);

  useEffect(() => {
    if (!mobileNavigationOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileNavigationOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileNavigationOpen]);

  const title = getRouteTitle(pathname);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar
        pathname={pathname}
        className="hidden md:flex"
      />

      {mobileNavigationOpen ? (
        <div
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navegación principal"
        >
          <button
            type="button"
            aria-label="Cerrar navegación"
            className="absolute inset-0 bg-slate-950/60"
            onClick={() => setMobileNavigationOpen(false)}
          />

          <Sidebar
            pathname={pathname}
            className="relative z-10 flex h-full max-w-72"
            onNavigate={() => setMobileNavigationOpen(false)}
            showCloseButton
            onClose={() => setMobileNavigationOpen(false)}
          />
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header
          title={title}
          onMenuClick={() => setMobileNavigationOpen(true)}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
