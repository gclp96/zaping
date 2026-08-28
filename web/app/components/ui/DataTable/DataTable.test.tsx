import { useState } from 'react';
import {
  cleanup,
  fireEvent,
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

import Button from '../Button';

import DataTable, { type DataTableProps } from './DataTable';
import DataTableToolbar from './DataTableToolbar';
import RowActionsMenu from './RowActionsMenu';

import type {
  DataTableColumn,
  DataTableRowAction,
  SortState,
} from './DataTable.types';

type Person = {
  id: string;
  name: string;
  age: number;
  city: string;
};

const people: Person[] = [
  { id: 'person-2', name: 'Zoe', age: 31, city: 'Hermosillo' },
  { id: 'person-1', name: 'Ana', age: 26, city: 'Nogales' },
];

const columns: DataTableColumn<Person>[] = [
  {
    id: 'name',
    header: 'Nombre',
    cell: (person) => <strong>{person.name.toUpperCase()}</strong>,
    sortable: true,
    priority: 'primary',
  },
  {
    id: 'age',
    header: 'Edad',
    cell: (person) => person.age,
    sortable: true,
    align: 'end',
    priority: 'secondary',
    minWidth: 120,
  },
  {
    id: 'city',
    header: 'Ciudad',
    cell: (person) => person.city,
    priority: 'tertiary',
  },
];

const emptyState = {
  title: 'Sin personas',
  description: 'No existen personas registradas.',
};

function createRect({
  left,
  top,
  width,
  height,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
}): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function mockMenuGeometry({
  trigger,
  menu,
  viewport = { width: 1024, height: 768 },
}: {
  trigger: { left: number; top: number; width: number; height: number };
  menu: { left: number; top: number; width: number; height: number };
  viewport?: { width: number; height: number };
}) {
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(viewport.width);
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(viewport.height);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function getBoundingClientRect() {
      if (this.getAttribute('aria-haspopup') === 'menu') {
        return createRect(trigger);
      }

      if (this.getAttribute('role') === 'menu') {
        return createRect(menu);
      }

      return createRect({ left: 0, top: 0, width: 0, height: 0 });
    },
  );
}

function renderTable(
  overrides: Partial<DataTableProps<Person>> = {},
) {
  return render(
    <DataTable
      caption="Directorio de personas"
      rows={people}
      columns={columns}
      getRowId={(person) => person.id}
      emptyState={emptyState}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DataTable data and semantics', () => {
  it('renders typed headers, custom cells, stable row ids and an accessible name', () => {
    const getRowId = vi.fn((person: Person) => person.id);

    renderTable({ getRowId });

    expect(
      screen.getByRole('table', { name: 'Directorio de personas' }),
    ).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Edad' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Ciudad' })).toBeTruthy();
    expect(screen.getByText('ZOE').tagName).toBe('STRONG');
    expect(screen.getByText('ANA').tagName).toBe('STRONG');
    expect(getRowId).toHaveBeenCalledWith(people[0]);
    expect(getRowId).toHaveBeenCalledWith(people[1]);

    for (const header of screen.getAllByRole('columnheader')) {
      expect(header.getAttribute('scope')).toBe('col');
    }
  });

  it('applies alignment, priority and numeric min-width contracts', () => {
    renderTable();

    const nameHeader = screen.getByRole('columnheader', { name: 'Nombre' });
    const ageHeader = screen.getByRole('columnheader', { name: 'Edad' });
    const cityHeader = screen.getByRole('columnheader', { name: 'Ciudad' });

    expect(nameHeader.classList.contains('hidden')).toBe(false);
    expect(ageHeader.classList.contains('hidden')).toBe(true);
    expect(ageHeader.classList.contains('sm:table-cell')).toBe(true);
    expect(ageHeader.classList.contains('text-right')).toBe(true);
    expect(ageHeader.style.minWidth).toBe('120px');
    expect(cityHeader.classList.contains('hidden')).toBe(true);
    expect(cityHeader.classList.contains('md:table-cell')).toBe(true);

    const ageCell = screen.getByText('31').closest('td');
    expect(ageCell?.classList.contains('text-right')).toBe(true);
    expect(ageCell?.style.minWidth).toBe('120px');
  });
});

describe('DataTable sorting', () => {
  function SortingHarness({
    onChange,
  }: {
    onChange: (state: SortState) => void;
  }) {
    const [state, setState] = useState<SortState>(null);

    return (
      <DataTable
        caption="Directorio ordenable"
        rows={people}
        columns={columns}
        getRowId={(person) => person.id}
        emptyState={emptyState}
        sorting={{
          state,
          onChange: (nextState) => {
            onChange(nextState);
            setState(nextState);
          },
        }}
      />
    );
  }

  it('cycles none to asc to desc to none and reports aria-sort', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<SortingHarness onChange={onChange} />);

    const ageHeader = screen.getByRole('columnheader', { name: 'Edad' });
    const ageButton = within(ageHeader).getByRole('button', { name: 'Edad' });
    const nameHeader = screen.getByRole('columnheader', { name: 'Nombre' });
    const nameButton = within(nameHeader).getByRole('button', {
      name: 'Nombre',
    });

    expect(ageHeader.hasAttribute('aria-sort')).toBe(false);
    expect(nameHeader.hasAttribute('aria-sort')).toBe(false);

    await user.click(ageButton);
    expect(onChange).toHaveBeenLastCalledWith({
      columnId: 'age',
      direction: 'asc',
    });
    expect(ageHeader.getAttribute('aria-sort')).toBe('ascending');
    expect(nameHeader.hasAttribute('aria-sort')).toBe(false);

    await user.click(ageButton);
    expect(onChange).toHaveBeenLastCalledWith({
      columnId: 'age',
      direction: 'desc',
    });
    expect(ageHeader.getAttribute('aria-sort')).toBe('descending');
    expect(nameHeader.hasAttribute('aria-sort')).toBe(false);

    await user.click(ageButton);
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(ageHeader.hasAttribute('aria-sort')).toBe(false);
    expect(nameHeader.hasAttribute('aria-sort')).toBe(false);

    await user.click(nameButton);
    expect(onChange).toHaveBeenLastCalledWith({
      columnId: 'name',
      direction: 'asc',
    });
    expect(nameHeader.getAttribute('aria-sort')).toBe('ascending');
    expect(ageHeader.hasAttribute('aria-sort')).toBe(false);

    await user.click(ageButton);
    expect(onChange).toHaveBeenLastCalledWith({
      columnId: 'age',
      direction: 'asc',
    });
    expect(ageHeader.getAttribute('aria-sort')).toBe('ascending');
    expect(nameHeader.hasAttribute('aria-sort')).toBe(false);
  });

  it('does not expose aria-sort without a sorting controller', () => {
    renderTable();

    expect(
      screen
        .getByRole('columnheader', { name: 'Nombre' })
        .hasAttribute('aria-sort'),
    ).toBe(false);
    expect(
      screen
        .getByRole('columnheader', { name: 'Edad' })
        .hasAttribute('aria-sort'),
    ).toBe(false);
  });

  it('does not make non-sortable headers interactive or reorder rows', async () => {
    const user = userEvent.setup();

    render(<SortingHarness onChange={vi.fn()} />);

    const cityHeader = screen.getByRole('columnheader', { name: 'Ciudad' });
    expect(within(cityHeader).queryByRole('button')).toBeNull();
    expect(cityHeader.hasAttribute('aria-sort')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Nombre' }));

    const dataRows = screen.getAllByRole('row').slice(1);
    expect(within(dataRows[0]).getByText('ZOE')).toBeTruthy();
    expect(within(dataRows[1]).getByText('ANA')).toBeTruthy();
  });
});

describe('DataTableToolbar', () => {
  it('presents controlled search, select filters, reset and actions', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    const onFilterChange = vi.fn();
    const onReset = vi.fn();
    const onExport = vi.fn();

    function ToolbarHarness() {
      const [search, setSearch] = useState('');
      const [status, setStatus] = useState('');

      return (
        <DataTableToolbar
          search={{
            value: search,
            label: 'Buscar personas',
            placeholder: 'Nombre o ciudad',
            onChange: (value) => {
              onSearchChange(value);
              setSearch(value);
            },
          }}
          filters={[
            {
              id: 'status',
              label: 'Estado',
              value: status,
              options: [
                { value: 'ACTIVE', label: 'Activo' },
                { value: 'INACTIVE', label: 'Inactivo' },
              ],
              onChange: (value) => {
                onFilterChange(value);
                setStatus(value);
              },
            },
          ]}
          onReset={() => {
            onReset();
            setSearch('');
            setStatus('');
          }}
          actions={
            <Button type="button" onClick={onExport}>
              Exportar
            </Button>
          }
        />
      );
    }

    render(<ToolbarHarness />);

    const search = screen.getByRole('searchbox', {
      name: 'Buscar personas',
    });
    await user.type(search, 'Ana');
    expect(onSearchChange).toHaveBeenLastCalledWith('Ana');

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Estado' }),
      'ACTIVE',
    );
    expect(onFilterChange).toHaveBeenCalledWith('ACTIVE');

    await user.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(onExport).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect((search as HTMLInputElement).value).toBe('');
    expect(
      (screen.getByRole('combobox', { name: 'Estado' }) as HTMLSelectElement)
        .value,
    ).toBe('');
  });
});

describe('DataTable pagination', () => {
  it('renders every provided row without slicing pagination data', () => {
    renderTable({
      pagination: {
        pageIndex: 0,
        pageSize: 1,
        totalRows: 2,
        onPageChange: vi.fn(),
        onPageSizeChange: vi.fn(),
      },
    });

    expect(screen.getByText('ZOE')).toBeTruthy();
    expect(screen.getByText('ANA')).toBeTruthy();
  });

  it('is optional and emits controlled page and page-size changes', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    const { rerender } = render(
      <DataTable
        caption="Directorio paginado"
        rows={[people[0]]}
        columns={columns}
        getRowId={(person) => person.id}
        emptyState={emptyState}
      />,
    );

    expect(
      screen.queryByRole('navigation', { name: 'Paginación de tabla' }),
    ).toBeNull();

    rerender(
      <DataTable
        caption="Directorio paginado"
        rows={[people[0]]}
        columns={columns}
        getRowId={(person) => person.id}
        emptyState={emptyState}
        pagination={{
          pageIndex: 1,
          pageSize: 10,
          totalRows: 23,
          onPageChange,
          onPageSizeChange,
        }}
      />,
    );

    expect(screen.getByText('Mostrando 11-20 de 23')).toBeTruthy();
    expect(screen.getByText('Página 2 de 3')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Página anterior' }));
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 0);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 2);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filas por página' }),
      '25',
    );
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });

  it('disables pagination controls at their boundaries', () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    const baseProps = {
      caption: 'Directorio paginado',
      rows: [people[0]],
      columns,
      getRowId: (person: Person) => person.id,
      emptyState,
    };

    const { rerender } = render(
      <DataTable
        {...baseProps}
        pagination={{
          pageIndex: 0,
          pageSize: 10,
          totalRows: 11,
          onPageChange,
          onPageSizeChange,
        }}
      />,
    );

    expect(
      (screen.getByRole('button', {
        name: 'Página anterior',
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', {
        name: 'Página siguiente',
      }) as HTMLButtonElement).disabled,
    ).toBe(false);

    rerender(
      <DataTable
        {...baseProps}
        pagination={{
          pageIndex: 1,
          pageSize: 10,
          totalRows: 11,
          onPageChange,
          onPageSizeChange,
        }}
      />,
    );

    expect(
      (screen.getByRole('button', {
        name: 'Página siguiente',
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('represents an out-of-range controlled page index without clamping it', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    renderTable({
      rows: [people[0]],
      pagination: {
        pageIndex: 5,
        pageSize: 10,
        totalRows: 23,
        onPageChange,
        onPageSizeChange: vi.fn(),
      },
    });

    expect(screen.getByText('Página 6 de 3')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });
});

describe('RowActionsMenu', () => {
  const edit = vi.fn();
  const archive = vi.fn();
  const deactivate = vi.fn();
  const actions: DataTableRowAction<Person>[] = [
    {
      id: 'edit',
      label: 'Editar',
      onSelect: edit,
    },
    {
      id: 'archive',
      label: 'Archivar',
      onSelect: archive,
      disabled: true,
    },
    {
      id: 'deactivate',
      label: 'Desactivar',
      variant: 'destructive',
      onSelect: deactivate,
    },
  ];

  afterEach(() => {
    edit.mockReset();
    archive.mockReset();
    deactivate.mockReset();
  });

  it('opens accessibly, focuses the first action and supports selection', async () => {
    const user = userEvent.setup();

    render(
      <RowActionsMenu
        row={people[0]}
        label="Acciones de Zoe"
        actions={actions}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Acciones de Zoe' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await user.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu', { name: 'Acciones de Zoe' })).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole('menuitem', { name: 'Editar' }),
    );
    const disabledAction = screen.getByRole('menuitem', {
      name: 'Archivar',
    }) as HTMLButtonElement;
    expect(disabledAction.disabled).toBe(true);
    await user.click(disabledAction);
    expect(archive).not.toHaveBeenCalled();
    expect(
      screen.getByRole('menuitem', {
        name: 'Acción destructiva: Desactivar',
      }),
    ).toBeTruthy();

    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
    expect(edit).toHaveBeenCalledWith(people[0]);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('portals the panel to body and positions it below from the trigger rect', async () => {
    const user = userEvent.setup();
    mockMenuGeometry({
      trigger: { left: 200, top: 104, width: 36, height: 36 },
      menu: { left: 0, top: 0, width: 176, height: 120 },
    });

    render(
      <div className="overflow-hidden">
        <RowActionsMenu
          row={people[0]}
          label="Acciones de Zoe"
          actions={actions}
        />
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Acciones de Zoe' }));

    const menu = screen.getByRole('menu', { name: 'Acciones de Zoe' });
    expect(menu.parentElement).toBe(document.body);
    expect(menu.classList.contains('fixed')).toBe(true);
    expect(menu.classList.contains('z-[var(--z-popover)]')).toBe(true);
    expect(menu.style.left).toBe('60px');
    expect(menu.style.top).toBe('144px');
    expect(menu.style.visibility).toBe('visible');
  });

  it('opens above when needed and clamps the panel inside the viewport', async () => {
    const user = userEvent.setup();
    mockMenuGeometry({
      trigger: { left: 360, top: 250, width: 36, height: 36 },
      menu: { left: 0, top: 0, width: 176, height: 120 },
      viewport: { width: 390, height: 300 },
    });

    render(
      <RowActionsMenu
        row={people[0]}
        label="Acciones de Zoe"
        actions={actions}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Acciones de Zoe' }));

    const menu = screen.getByRole('menu', { name: 'Acciones de Zoe' });
    expect(menu.style.left).toBe('206px');
    expect(menu.style.top).toBe('126px');
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup();

    render(
      <RowActionsMenu
        row={people[0]}
        label="Acciones de Zoe"
        actions={actions}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Acciones de Zoe' });
    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on outside click without invoking an action', async () => {
    const user = userEvent.setup();

    render(
      <div>
        <RowActionsMenu
          row={people[0]}
          label="Acciones de Zoe"
          actions={actions}
        />
        <button type="button">Fuera del menú</button>
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Acciones de Zoe' }));
    await user.click(screen.getByRole('button', { name: 'Fuera del menú' }));

    expect(screen.queryByRole('menu')).toBeNull();
    expect(edit).not.toHaveBeenCalled();
    expect(deactivate).not.toHaveBeenCalled();
  });

  it('closes on Tab and Shift+Tab without preventing default or restoring focus', async () => {
    const user = userEvent.setup();

    render(
      <RowActionsMenu
        row={people[0]}
        label="Acciones de Zoe"
        actions={actions}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Acciones de Zoe' });
    await user.click(trigger);
    const firstAction = screen.getByRole('menuitem', { name: 'Editar' });

    expect(fireEvent.keyDown(firstAction, { key: 'Tab' })).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).not.toBe(trigger);

    await user.click(trigger);
    const reopenedAction = screen.getByRole('menuitem', { name: 'Editar' });
    expect(
      fireEvent.keyDown(reopenedAction, { key: 'Tab', shiftKey: true }),
    ).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).not.toBe(trigger);
  });

  it('closes on container or page scroll and viewport resize', async () => {
    const user = userEvent.setup();

    const { container } = render(
      <div className="overflow-x-auto">
        <RowActionsMenu
          row={people[0]}
          label="Acciones de Zoe"
          actions={actions}
        />
      </div>,
    );

    const trigger = screen.getByRole('button', { name: 'Acciones de Zoe' });
    await user.click(trigger);
    fireEvent.scroll(container.firstElementChild as HTMLElement);
    expect(screen.queryByRole('menu')).toBeNull();

    await user.click(trigger);
    fireEvent.scroll(window);
    expect(screen.queryByRole('menu')).toBeNull();

    await user.click(trigger);
    fireEvent.resize(window);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('disables the trigger when every row action is disabled', async () => {
    const user = userEvent.setup();

    render(
      <RowActionsMenu
        row={people[0]}
        label="Acciones de Zoe"
        actions={[
          { ...actions[0], disabled: true },
          { ...actions[1], disabled: () => true },
        ]}
      />,
    );

    const trigger = screen.getByRole('button', {
      name: 'Acciones de Zoe',
    }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);

    await user.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('supports trigger and menu keyboard navigation while skipping disabled actions', async () => {
    const user = userEvent.setup();

    render(
      <RowActionsMenu
        row={people[0]}
        label="Acciones de Zoe"
        actions={actions}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Acciones de Zoe' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');

    expect(document.activeElement).toBe(
      screen.getByRole('menuitem', { name: 'Editar' }),
    );
    await user.keyboard('{ArrowDown}{Enter}');

    expect(deactivate).toHaveBeenCalledWith(people[0]);
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the actions column primary and always visible', () => {
    renderTable({
      rowActions: {
        label: (person) => `Acciones de ${person.name}`,
        actions,
      },
    });

    const actionsHeader = screen.getByRole('columnheader', {
      name: 'Acciones',
    });
    expect(actionsHeader.classList.contains('hidden')).toBe(false);
    expect(
      screen.getByRole('button', { name: 'Acciones de Zoe' }),
    ).toBeTruthy();
  });
});

describe('DataTable states', () => {
  it('renders loading without rendering data rows', () => {
    renderTable({ loading: true, loadingMessage: 'Cargando personas...' });

    expect(screen.getByText('Cargando personas...')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('distinguishes empty and filtered-empty states', () => {
    const { rerender } = render(
      <DataTable
        caption="Directorio vacío"
        rows={[]}
        columns={columns}
        getRowId={(person) => person.id}
        emptyState={emptyState}
        filteredEmptyState={{
          title: 'Sin coincidencias',
          description: 'Ninguna persona coincide con los filtros.',
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Sin personas' })).toBeTruthy();

    rerender(
      <DataTable
        caption="Directorio vacío"
        rows={[]}
        columns={columns}
        getRowId={(person) => person.id}
        emptyState={emptyState}
        filteredEmptyState={{
          title: 'Sin coincidencias',
          description: 'Ninguna persona coincide con los filtros.',
        }}
        isFiltered
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Sin coincidencias' }),
    ).toBeTruthy();
  });

  it('renders an error with an optional retry callback', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    renderTable({
      error: {
        message: 'No fue posible cargar las personas.',
        onRetry,
      },
    });

    expect(screen.getByRole('alert').textContent).toContain(
      'No fue posible cargar las personas.',
    );
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('renders normal data when no transient state is active', () => {
    renderTable();

    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('Hermosillo')).toBeTruthy();
  });
});
