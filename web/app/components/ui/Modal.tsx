'use client';

import { createPortal } from 'react-dom';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

export type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  description?: ReactNode;
  dismissible?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
};

const focusableSelector = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let openModalCount = 0;
let previousBodyOverflow: string | null = null;

function isVisible(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;

  while (current) {
    if (
      current.hasAttribute('hidden') ||
      current.getAttribute('aria-hidden') === 'true'
    ) {
      return false;
    }

    const style = window.getComputedStyle(current);

    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    current = current.parentElement;
  }

  return true;
}

function isFocusable(element: HTMLElement): boolean {
  return (
    element.matches(focusableSelector) &&
    !element.matches(':disabled') &&
    isVisible(element)
  );
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter(isFocusable);
}

function focusElement(element: HTMLElement): void {
  element.focus({ preventScroll: true });
}

function focusDialog(dialog: HTMLElement): void {
  const focusableElements = getFocusableElements(dialog);
  const firstContentControl = focusableElements.find(
    (element) => !element.hasAttribute('data-modal-close'),
  );

  focusElement(firstContentControl ?? focusableElements[0] ?? dialog);
}

function getTopmostDialog(
  excludedRoot: HTMLElement | null = null,
): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const roots = Array.from(
    document.querySelectorAll<HTMLElement>('[data-modal-root]'),
  );

  for (let index = roots.length - 1; index >= 0; index -= 1) {
    const root = roots[index];

    if (root !== excludedRoot) {
      return root.querySelector<HTMLElement>('[role="dialog"]');
    }
  }

  return null;
}

function lockBodyScroll(): void {
  if (openModalCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  openModalCount += 1;
}

function unlockBodyScroll(): void {
  openModalCount = Math.max(0, openModalCount - 1);

  if (openModalCount === 0) {
    document.body.style.overflow = previousBodyOverflow ?? '';
    previousBodyOverflow = null;
  }
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  description,
  dismissible = true,
  initialFocusRef,
}: ModalProps) {
  const [portalTarget, setPortalTarget] =
    useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const committedOpenRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const hasDescription = description !== undefined && description !== null;

  useEffect(() => {
    // The portal target is client-only and must be state-gated for hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    function handleFocusIn(event: FocusEvent) {
      if (isOpen || !(event.target instanceof HTMLElement)) {
        return;
      }

      if (!event.target.closest('[data-modal-root]')) {
        lastFocusedElementRef.current = event.target;
      }
    }

    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || !portalTarget || !dialogRef.current) {
      return;
    }

    const dialog = dialogRef.current;
    const activeElement = document.activeElement;

    if (dialog.contains(activeElement)) {
      return;
    }

    const preferredElement = initialFocusRef?.current;

    if (
      preferredElement &&
      dialog.contains(preferredElement) &&
      isFocusable(preferredElement)
    ) {
      focusElement(preferredElement);
      return;
    }

    focusDialog(dialog);
  }, [initialFocusRef, isOpen, portalTarget]);

  useLayoutEffect(() => {
    if (isOpen) {
      if (!committedOpenRef.current) {
        const activeElement = document.activeElement;
        const lastFocusedElement = lastFocusedElementRef.current;

        openerRef.current =
          lastFocusedElement ??
          (activeElement instanceof HTMLElement ? activeElement : null);
        committedOpenRef.current = true;
      }

      return;
    }

    if (!committedOpenRef.current) {
      return;
    }

    committedOpenRef.current = false;
    const opener = openerRef.current;
    const topmostDialog = getTopmostDialog(rootRef.current);

    if (topmostDialog) {
      if (opener && topmostDialog.contains(opener) && isFocusable(opener)) {
        focusElement(opener);
      } else {
        focusDialog(topmostDialog);
      }
    } else if (opener && opener.isConnected && isFocusable(opener)) {
      focusElement(opener);
    } else {
      document.body.focus();
    }

    openerRef.current = null;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !portalTarget) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const dialog = dialogRef.current;

      if (!dialog || getTopmostDialog() !== dialog) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();

        if (dismissible) {
          onClose();
        }

        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = getFocusableElements(dialog);

      if (focusableElements.length === 0) {
        event.preventDefault();
        focusElement(dialog);
        return;
      }

      const activeElement = document.activeElement;
      const activeIndex = focusableElements.indexOf(
        activeElement as HTMLElement,
      );

      if (!dialog.contains(activeElement)) {
        event.preventDefault();
        focusElement(
          event.shiftKey
            ? focusableElements[focusableElements.length - 1]
            : focusableElements[0],
        );
      } else if (
        event.shiftKey &&
        (activeIndex === 0 || activeIndex === -1)
      ) {
        event.preventDefault();
        focusElement(focusableElements[focusableElements.length - 1]);
      } else if (
        !event.shiftKey &&
        (activeIndex === focusableElements.length - 1 || activeIndex === -1)
      ) {
        event.preventDefault();
        focusElement(focusableElements[0]);
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [dismissible, isOpen, onClose, portalTarget]);

  if (!isOpen || !portalTarget) {
    return null;
  }

  const dialog = (
    <div
      ref={rootRef}
      data-modal-root
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/50"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hasDescription ? descriptionId : undefined}
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2
            id={titleId}
            className="pr-4 text-lg font-semibold text-gray-900"
          >
            {title}
          </h2>

          {dismissible ? (
            <button
              type="button"
              data-modal-close
              onClick={onClose}
              aria-label="Cerrar modal"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              x
            </button>
          ) : null}
        </div>

        {hasDescription ? (
          <p id={descriptionId} className="sr-only">
            {description}
          </p>
        ) : null}

        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );

  return createPortal(dialog, portalTarget);
}
