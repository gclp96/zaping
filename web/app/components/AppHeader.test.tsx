import {
  cleanup,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import AppHeader from './AppHeader';

afterEach(() => {
  cleanup();
});

describe('AppHeader', () => {
  it('renders compact page context below xl without introducing an h1', () => {
    render(
      <AppHeader
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
    expect(header.classList.contains('xl:hidden')).toBe(true);
    expect(header.classList.contains('lg:hidden')).toBe(false);
    expect(
      within(header).getByText('Productos').classList.contains('lg:sr-only'),
    ).toBe(false);
  });

  it('exposes the drawer relationship and current expanded state', () => {
    render(
      <AppHeader
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
  });

  it('invokes the mobile menu command without rendering placeholders', async () => {
    const user = userEvent.setup();
    const onMenuClick = vi.fn();

    render(
      <AppHeader
        title="Productos"
        mobileNavigationId="mobile-navigation"
        mobileNavigationOpen={false}
        onMenuClick={onMenuClick}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Abrir navegación' }),
    );

    expect(onMenuClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Cuenta')).toBeNull();
  });
});
