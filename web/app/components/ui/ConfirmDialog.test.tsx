import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ConfirmDialog from './ConfirmDialog';

function ConfirmHarness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir confirmación
      </button>
      <ConfirmDialog
        isOpen={open}
        title="Confirmar operación"
        message="Esta acción requiere confirmación."
        onClose={() => setOpen(false)}
        onConfirm={vi.fn()}
      />
    </>
  );
}

describe('ConfirmDialog', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  it('hereda semantics de dialog y enfoca Cancelar inicialmente', async () => {
    render(
      <ConfirmDialog
        isOpen
        title="Eliminar registro"
        message="El registro se conservará en el historial."
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const dialog = await screen.findByRole('dialog', {
      name: 'Eliminar registro',
    });

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Cancelar' }),
    );
  });

  it('cancela con Escape y conserva confirm/cancel behavior', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        isOpen
        title="Confirmar acción"
        message="Mensaje de confirmación"
        onClose={onClose}
        onConfirm={onConfirm}
        confirmText="Confirmar"
      />,
    );

    await screen.findByRole('dialog', { name: 'Confirmar acción' });
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('bloquea dismissal y oculta el cierre durante loading', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        isOpen
        loading
        title="Procesando operación"
        message="Espera un momento."
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    await screen.findByRole('dialog', { name: 'Procesando operación' });
    expect(screen.queryByRole('button', { name: 'Cerrar modal' })).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
  });

  it('restaura el foco al trigger después de cancelar', async () => {
    const user = userEvent.setup();

    render(<ConfirmHarness />);

    const trigger = screen.getByRole('button', {
      name: 'Abrir confirmación',
    });
    await user.click(trigger);
    await screen.findByRole('dialog', { name: 'Confirmar operación' });

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });
});
