import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Modal from './Modal';

function RestorableModalHarness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir modal
      </button>
      <Modal
        isOpen={open}
        title="Modal restaurable"
        onClose={() => setOpen(false)}
      >
        <button type="button">Acción del modal</button>
      </Modal>
    </>
  );
}

function DetachedOpenerHarness() {
  const [open, setOpen] = useState(false);
  const [showTrigger, setShowTrigger] = useState(true);

  return (
    <>
      {showTrigger ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setShowTrigger(false);
          }}
        >
          Abrir y retirar trigger
        </button>
      ) : null}
      <Modal
        isOpen={open}
        title="Modal sin trigger"
        onClose={() => setOpen(false)}
      >
        <button type="button">Acción del modal</button>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  it('renderiza semantics, nombre accesible, descripción y portal', async () => {
    render(
      <Modal
        isOpen
        title="Modal de prueba"
        description="Descripción accesible"
        onClose={vi.fn()}
      >
        <button type="button">Acción principal</button>
      </Modal>,
    );

    const dialog = await screen.findByRole('dialog', {
      name: 'Modal de prueba',
    });

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(screen.getByText('Descripción accesible')).toBeTruthy();
  });

  it('enfoca el primer control de contenido al abrir', async () => {
    render(
      <Modal isOpen title="Modal de foco" onClose={vi.fn()}>
        <button type="button">Primera acción</button>
        <button type="button">Segunda acción</button>
      </Modal>,
    );

    const firstAction = await screen.findByRole('button', {
      name: 'Primera acción',
    });

    expect(document.activeElement).toBe(firstAction);
  });

  it('envuelve Tab y Shift+Tab dentro del modal', async () => {
    const user = userEvent.setup();

    render(
      <Modal isOpen title="Modal navegable" onClose={vi.fn()}>
        <button type="button">Primera acción</button>
        <button type="button">Última acción</button>
      </Modal>,
    );

    const closeButton = await screen.findByRole('button', {
      name: 'Cerrar modal',
    });
    const firstAction = screen.getByRole('button', {
      name: 'Primera acción',
    });
    const lastAction = screen.getByRole('button', {
      name: 'Última acción',
    });

    lastAction.focus();
    await user.tab();
    expect(document.activeElement).toBe(closeButton);

    closeButton.focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(lastAction);

    firstAction.focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(closeButton);
  });

  it('mantiene el foco dentro cuando el foco estaba fuera del modal', async () => {
    const user = userEvent.setup();

    render(
      <>
        <button type="button">Control externo</button>
        <Modal isOpen title="Modal aislado" onClose={vi.fn()}>
          <button type="button">Control interno</button>
        </Modal>
      </>,
    );

    const outsideControl = screen.getByRole('button', {
      name: 'Control externo',
    });
    const closeButton = await screen.findByRole('button', {
      name: 'Cerrar modal',
    });

    outsideControl.focus();
    await user.tab();

    expect(document.activeElement).toBe(closeButton);
  });

  it('enfoca el container cuando no hay controles focusables', async () => {
    const user = userEvent.setup();

    render(
      <Modal
        isOpen
        title="Modal sin controles"
        dismissible={false}
        onClose={vi.fn()}
      >
        <p>Contenido informativo</p>
      </Modal>,
    );

    const dialog = await screen.findByRole('dialog', {
      name: 'Modal sin controles',
    });

    expect(document.activeElement).toBe(dialog);
    await user.tab();
    expect(document.activeElement).toBe(dialog);
  });

  it('cierra sólo el modal topmost con Escape', async () => {
    const user = userEvent.setup();
    const firstOnClose = vi.fn();
    const secondOnClose = vi.fn();

    render(
      <>
        <Modal isOpen title="Modal inferior" onClose={firstOnClose}>
          <button type="button">Acción inferior</button>
        </Modal>
        <Modal isOpen title="Modal superior" onClose={secondOnClose}>
          <button type="button">Acción superior</button>
        </Modal>
      </>,
    );

    const topAction = await screen.findByRole('button', {
      name: 'Acción superior',
    });
    topAction.focus();

    await user.keyboard('{Escape}');

    expect(secondOnClose).toHaveBeenCalledTimes(1);
    expect(firstOnClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(topAction);
  });

  it('bloquea Escape y oculta el cierre cuando dismissible es false', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Modal
        isOpen
        title="Modal no descartable"
        dismissible={false}
        onClose={onClose}
      >
        <button type="button">Acción protegida</button>
      </Modal>,
    );

    expect(
      await screen.findByRole('dialog', { name: 'Modal no descartable' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cerrar modal' })).toBeNull();

    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
  });

  it('restaura el foco al trigger conectado al cerrar', async () => {
    const user = userEvent.setup();

    render(<RestorableModalHarness />);

    const trigger = screen.getByRole('button', { name: 'Abrir modal' });
    await user.click(trigger);
    await screen.findByRole('dialog', { name: 'Modal restaurable' });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it('no falla ni enfoca un trigger detached al cerrar', async () => {
    const user = userEvent.setup();

    render(<DetachedOpenerHarness />);

    const trigger = screen.getByRole('button', {
      name: 'Abrir y retirar trigger',
    });
    await user.click(trigger);
    await screen.findByRole('dialog', { name: 'Modal sin trigger' });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(trigger.isConnected).toBe(false);
    expect(document.activeElement).not.toBe(trigger);
  });

  it('mantiene el body bloqueado hasta cerrar el último modal', async () => {
    document.body.style.overflow = 'auto';

    const first = render(
      <Modal isOpen title="Primer modal" onClose={vi.fn()}>
        <button type="button">Primero</button>
      </Modal>,
    );
    await screen.findByRole('dialog', { name: 'Primer modal' });
    expect(document.body.style.overflow).toBe('hidden');

    const second = render(
      <Modal isOpen title="Segundo modal" onClose={vi.fn()}>
        <button type="button">Segundo</button>
      </Modal>,
    );
    await screen.findByRole('dialog', { name: 'Segundo modal' });

    first.unmount();
    expect(document.body.style.overflow).toBe('hidden');

    second.unmount();
    expect(document.body.style.overflow).toBe('auto');
  });
});
