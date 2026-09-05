'use client';

import { Menu } from 'lucide-react';
import type { Ref } from 'react';

type AppHeaderProps = {
  title: string;
  mobileNavigationId: string;
  mobileNavigationOpen: boolean;
  menuButtonRef?: Ref<HTMLButtonElement>;
  onMenuClick: () => void;
};

export default function AppHeader({
  title,
  mobileNavigationId,
  mobileNavigationOpen,
  menuButtonRef,
  onMenuClick,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] flex h-14 shrink-0 items-center border-b border-border bg-surface/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/90 lg:px-6 xl:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="Abrir navegación"
          aria-controls={mobileNavigationId}
          aria-expanded={mobileNavigationOpen}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-ui-md border border-border text-text-secondary transition-colors duration-[var(--motion-duration-fast)] hover:bg-surface-subtle hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={onMenuClick}
        >
          <Menu aria-hidden="true" size={20} />
        </button>

        <p className="truncate text-sm font-semibold text-text">
          {title}
        </p>
      </div>
    </header>
  );
}
