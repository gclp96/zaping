import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AppHeader from './AppHeader';

const account = {
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@example.test',
};

afterEach(() => {
  cleanup();
});

describe('AppHeader', () => {
  it('renders persistent page context and account without introducing an h1', () => {
    render(
      <AppHeader
        pathname="/products"
        user={account}
        onLogout={vi.fn()}
        title="Productos"
        mobileNavigationId="mobile-navigation"
        mobileNavigationOpen={false}
        onMenuClick={vi.fn()}
      />,
    );

    const header = screen.getByRole('banner');

    expect(within(header).getByText('Productos')).toBeTruthy();
    expect(within(header).queryByRole('heading', { level: 1 })).toBeNull();
    expect(header.classList.contains('sticky')).toBe(true);
    expect(header.classList.contains('xl:hidden')).toBe(false);
    expect(
      screen.getByRole('button', { name: 'Cuenta de Ana Pérez' }),
    ).toBeTruthy();
    expect(header.classList.contains('lg:hidden')).toBe(false);
    expect(
      within(header).getByText('Productos').classList.contains('lg:sr-only'),
    ).toBe(false);
  });

  it('exposes the drawer relationship and current expanded state', () => {
    render(
      <AppHeader
        pathname="/products"
        user={account}
        onLogout={vi.fn()}
        title="Productos"
        mobileNavigationId="mobile-navigation"
        mobileNavigationOpen
        onMenuClick={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', {
      name: 'Abrir navegación',
    });

    expect(button.getAttribute('aria-controls')).toBe('mobile-navigation');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.classList.contains('lg:hidden')).toBe(false);
    expect(button.classList.contains('xl:hidden')).toBe(true);
    expect(
      screen.queryByRole('button', { name: 'Cuenta de Ana Pérez' }),
    ).toBeNull();
  });

  it('invokes the mobile menu command without rendering placeholders', async () => {
    const user = userEvent.setup();
    const onMenuClick = vi.fn();

    render(
      <AppHeader
        pathname="/products"
        user={account}
        onLogout={vi.fn()}
        title="Productos"
        mobileNavigationId="mobile-navigation"
        mobileNavigationOpen={false}
        onMenuClick={onMenuClick}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Abrir navegación' }));

    expect(onMenuClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByText('Notificaciones')).toBeNull();
    expect(screen.queryByText('Company')).toBeNull();
  });
});
