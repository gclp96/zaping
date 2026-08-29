import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import StaticTable from './StaticTable';

type Row = {
  id: string;
  name: string;
  amount: number;
};

const rows: Row[] = [
  { id: 'row-1', name: 'Primero', amount: 10 },
  { id: 'row-2', name: 'Segundo', amount: 20 },
];

const columns = [
  {
    id: 'name',
    header: 'Nombre',
    cell: (row: Row) => row.name,
  },
  {
    id: 'amount',
    header: 'Importe',
    align: 'end' as const,
    minWidth: 120,
    cell: (row: Row) => `$${row.amount}`,
  },
];

describe('StaticTable', () => {
  afterEach(() => {
    cleanup();
  });

  it('renderiza caption, headers y celdas mediante columnas tipadas', () => {
    render(
      <StaticTable
        caption="Tabla estática de prueba"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
      />,
    );

    expect(
      screen.getByRole('table', { name: 'Tabla estática de prueba' }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole('columnheader').map((header) =>
        header.textContent?.trim(),
      ),
    ).toEqual(['Nombre', 'Importe']);
    expect(screen.getByText('Primero')).toBeTruthy();
    expect(screen.getByText('$20')).toBeTruthy();
    expect(
      screen.getByRole('columnheader', { name: 'Importe' }).getAttribute(
        'scope',
      ),
    ).toBe('col');
  });

  it('usa las keys proporcionadas y expone alineación y minWidth observables', () => {
    const getRowKey = vi.fn((row: Row) => row.id);

    render(
      <StaticTable
        columns={columns}
        rows={rows}
        getRowKey={getRowKey}
      />,
    );

    expect(getRowKey).toHaveBeenCalledWith(rows[0]);
    expect(getRowKey).toHaveBeenCalledWith(rows[1]);
    expect(
      screen.getByRole('columnheader', { name: 'Importe' }).classList.contains(
        'text-right',
      ),
    ).toBe(true);
    expect(
      screen.getByRole('columnheader', { name: 'Importe' }).style.minWidth,
    ).toBe('120px');
    expect(
      within(screen.getAllByRole('row')[1]).getByText('$10'),
    ).toBeTruthy();
  });

  it('renderiza emptyState cuando no hay filas', () => {
    render(
      <StaticTable
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
        emptyState={<span>Sin partidas en este documento</span>}
      />,
    );

    expect(screen.getByText('Sin partidas en este documento')).toBeTruthy();
    expect(screen.queryByText('Primero')).toBeNull();
  });
});
