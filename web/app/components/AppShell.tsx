"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import AppHeader from "@/app/components/AppHeader";
import { useAuthenticatedSession } from "@/app/auth-session";
import { getRouteTitle } from "@/app/components/navigation";
import Sidebar from "@/app/components/sidebar";

export const SIDEBAR_COLLAPSED_STORAGE_KEY = "zaping.sidebar.collapsed";

const MOBILE_NAVIGATION_ID = "mobile-navigation-drawer";

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPreferenceReady, setSidebarPreferenceReady] = useState(false);
  const sessionState = useAuthenticatedSession();
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerWasOpenRef = useRef(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      const storedPreference = window.localStorage.getItem(
        SIDEBAR_COLLAPSED_STORAGE_KEY,
      );

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSidebarCollapsed(storedPreference === "true");
    } catch {
      // The expanded default remains usable when storage is unavailable.
    } finally {
      setSidebarPreferenceReady(true);
    }
  }, []);

  useEffect(() => {
    if (!mobileNavigationOpen) {
      if (drawerWasOpenRef.current) {
        menuButtonRef.current?.focus();
      }

      drawerWasOpenRef.current = false;
      return;
    }

    drawerWasOpenRef.current = true;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileNavigationOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileNavigationOpen]);

  const title = getRouteTitle(pathname);
  const currentUserRole =
    sessionState.status === "success" ? sessionState.user.role : undefined;

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((currentValue) => {
      const nextValue = !currentValue;

      try {
        window.localStorage.setItem(
          SIDEBAR_COLLAPSED_STORAGE_KEY,
          String(nextValue),
        );
      } catch {
        // The visual preference remains usable when storage is unavailable.
      }

      return nextValue;
    });
  }

  return (
    <div className="flex min-h-screen bg-surface-subtle text-text">
      <Sidebar
        id="desktop-navigation"
        pathname={pathname}
        collapsed={sidebarCollapsed}
        collapsible
        className="sticky top-0 hidden h-screen xl:flex"
        onToggleCollapsed={toggleSidebarCollapsed}
        transitionEnabled={sidebarPreferenceReady}
        currentUserRole={currentUserRole}
      />

      {mobileNavigationOpen ? (
        <div
          ref={drawerRef}
          id={MOBILE_NAVIGATION_ID}
          className="fixed inset-0 z-[var(--z-drawer)] xl:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navegación principal"
          tabIndex={-1}
        >
          <button
            type="button"
            aria-label="Cerrar navegación"
            data-testid="navigation-backdrop"
            tabIndex={-1}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px]"
            onClick={() => setMobileNavigationOpen(false)}
          />

          <Sidebar
            id="mobile-navigation"
            pathname={pathname}
            className="relative z-10 flex h-full w-[min(20rem,calc(100vw-2rem))] min-h-0"
            onNavigate={() => setMobileNavigationOpen(false)}
            showCloseButton
            onClose={() => setMobileNavigationOpen(false)}
            currentUserRole={currentUserRole}
          />
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AppHeader
          title={title}
          mobileNavigationId={MOBILE_NAVIGATION_ID}
          mobileNavigationOpen={mobileNavigationOpen}
          menuButtonRef={menuButtonRef}
          onMenuClick={() => setMobileNavigationOpen(true)}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
