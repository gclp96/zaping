'use client';

import { Menu } from 'lucide-react';
import type { Ref } from 'react';
import type { AuthenticatedSession } from '@/app/auth-session';
import UserMenu from './UserMenu';

type AppHeaderProps = {
  title: string;
  pathname: string;
  user: Pick<AuthenticatedSession, 'firstName' | 'lastName' | 'email'>;
  onLogout: () => void;
  mobileNavigationId: string;
  mobileNavigationOpen: boolean;
  menuButtonRef?: Ref<HTMLButtonElement>;
  onMenuClick: () => void;
};

export default function AppHeader({
  title,
  pathname,
  user,
  onLogout,
  mobileNavigationId,
  mobileNavigationOpen,
  menuButtonRef,
  onMenuClick,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/90 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="Abrir navegación"
          aria-controls={mobileNavigationId}
          aria-expanded={mobileNavigationOpen}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-ui-md border border-border text-text-secondary transition-colors duration-[var(--motion-duration-fast)] hover:bg-surface-subtle hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring xl:hidden"
          onClick={onMenuClick}
        >
          <Menu aria-hidden="true" size={20} />
        </button>

        <p className="truncate text-sm font-semibold text-text">
          {title}
        </p>
      </div>
      {mobileNavigationOpen ? null : <UserMenu key={pathname} user={user} onLogout={onLogout} />}
    </header>
  );
}
