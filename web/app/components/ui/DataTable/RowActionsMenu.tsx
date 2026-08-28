'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, TriangleAlert } from 'lucide-react';

import type { DataTableRowAction } from './DataTable.types';

export type RowActionsMenuProps<T> = {
  row: T;
  label: string;
  actions: readonly DataTableRowAction<T>[];
};

type MenuPosition = {
  left: number;
  top: number;
};

const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;

export default function RowActionsMenu<T>({
  row,
  label,
  actions,
}: RowActionsMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function isDisabled(action: DataTableRowAction<T>) {
    return typeof action.disabled === 'function'
      ? action.disabled(row)
      : Boolean(action.disabled);
  }

  const hasEnabledActions = actions.some((action) => !isDisabled(action));
  const menuOpen = open && hasEnabledActions;

  function focusItem(index: number) {
    const enabledItems = itemRefs.current.filter(
      (item): item is HTMLButtonElement => Boolean(item && !item.disabled),
    );

    if (enabledItems.length === 0) {
      return;
    }

    const normalizedIndex =
      (index + enabledItems.length) % enabledItems.length;
    enabledItems[normalizedIndex]?.focus();
  }

  function closeAndRestoreFocus() {
    setOpen(false);
    setPosition(null);
    triggerRef.current?.focus();
  }

  useLayoutEffect(() => {
    if (!menuOpen || !triggerRef.current || !menuRef.current) {
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const preferredLeft = triggerRect.right - menuRect.width;
    const maximumLeft = Math.max(
      VIEWPORT_MARGIN,
      window.innerWidth - menuRect.width - VIEWPORT_MARGIN,
    );
    const left = Math.min(
      Math.max(preferredLeft, VIEWPORT_MARGIN),
      maximumLeft,
    );
    const belowTop = triggerRect.bottom + MENU_GAP;
    const fitsBelow =
      belowTop + menuRect.height <= window.innerHeight - VIEWPORT_MARGIN;
    const top = fitsBelow
      ? belowTop
      : Math.max(
          VIEWPORT_MARGIN,
          triggerRect.top - MENU_GAP - menuRect.height,
        );

    setPosition({ left, top });
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    itemRefs.current
      .find((item) => Boolean(item && !item.disabled))
      ?.focus({ preventScroll: true });

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        !containerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
        setPosition(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeAndRestoreFocus();
      }
    }

    function handleViewportChange() {
      setOpen(false);
      setPosition(null);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [menuOpen]);

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const enabledItems = itemRefs.current.filter(
      (item): item is HTMLButtonElement => Boolean(item && !item.disabled),
    );
    const currentIndex = enabledItems.findIndex(
      (item) => item === document.activeElement,
    );

    if (event.key === 'Tab') {
      setOpen(false);
      setPosition(null);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(currentIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(currentIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusItem(enabledItems.length - 1);
    }
  }

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        title={label}
        className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!hasEnabledActions}
        onClick={() => {
          if (open) {
            setOpen(false);
            setPosition(null);
          } else {
            setOpen(true);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <MoreHorizontal aria-hidden="true" size={18} />
      </button>

      {menuOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              className="fixed z-[var(--z-popover)] min-w-44 rounded-lg border border-border bg-surface p-1 shadow-lg"
              style={{
                left: position?.left ?? 0,
                top: position?.top ?? 0,
                visibility: position ? 'visible' : 'hidden',
              }}
              onKeyDown={handleMenuKeyDown}
            >
              {actions.map((action, index) => {
                const disabled = isDisabled(action);
                const destructive = action.variant === 'destructive';

                return (
                  <button
                    key={action.id}
                    ref={(element) => {
                      itemRefs.current[index] = element;
                    }}
                    type="button"
                    role="menuitem"
                    aria-label={
                      destructive
                        ? `Acción destructiva: ${action.label}`
                        : undefined
                    }
                    tabIndex={-1}
                    disabled={disabled}
                    className={[
                      'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium',
                      'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-focus-ring',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                      destructive
                        ? 'text-danger hover:bg-danger-subtle'
                        : 'text-text hover:bg-surface-subtle',
                    ].join(' ')}
                    onClick={() => {
                      if (disabled) {
                        return;
                      }

                      setOpen(false);
                      setPosition(null);
                      triggerRef.current?.focus();
                      action.onSelect(row);
                    }}
                  >
                    {destructive ? (
                      <>
                        <TriangleAlert aria-hidden="true" size={16} />
                        <span className="sr-only">Acción destructiva: </span>
                      </>
                    ) : null}
                    {action.label}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
