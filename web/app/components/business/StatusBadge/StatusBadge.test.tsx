import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import StatusBadge from './StatusBadge';

describe('StatusBadge', () => {
  it('muestra la etiqueta recibida', () => {
    render(
      <StatusBadge
        label="Bajo stock"
        tone="warning"
      />,
    );

    expect(screen.getByText('Bajo stock')).toBeDefined();
  });

  it('aplica la descripción accesible', () => {
    render(
      <StatusBadge
        label="Sin stock"
        tone="danger"
        ariaLabel="Estado del inventario: sin stock"
      />,
    );

    const badge = screen
      .getByText('Sin stock')
      .closest('[aria-label]');

    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('aria-label')).toBe(
      'Estado del inventario: sin stock',
    );
  });

  it('oculta el icono decorativo para lectores de pantalla', () => {
    render(
      <StatusBadge
        label="En stock"
        tone="success"
        icon={<span data-testid="status-icon">✓</span>}
      />,
    );

    const iconContainer = screen.getByTestId('status-icon').parentElement;

    expect(iconContainer?.getAttribute('aria-hidden')).toBe('true');
  });

  it.each(
  [
    ['neutral', 'bg-gray-100'],
    ['info', 'bg-blue-100'],
    ['success', 'bg-green-100'],
    ['warning', 'bg-yellow-100'],
    ['danger', 'bg-red-100'],
  ] as const,
)(
  'convierte el tono %s a su representación visual',
  (tone, expectedClass) => {
    render(
      <StatusBadge
        label={`Estado ${tone}`}
        tone={tone}
      />,
    );

    const label = screen.getByText(`Estado ${tone}`);
    const badge = label.parentElement;

    expect(badge).not.toBeNull();
    expect(badge?.className).toContain(expectedClass);
  },
);
});