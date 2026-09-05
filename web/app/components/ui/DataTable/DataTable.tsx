'use client';

import type { CSSProperties, ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

import Button from '../Button';
import EmptyState from '../EmptyState';
import Loading from '../Loading';

import DataTablePagination from './DataTablePagination';
import RowActionsMenu from './RowActionsMenu';

import type {
  DataTableColumn,
  DataTableColumnAlignment,
  DataTableColumnPriority,
  DataTableEmptyState,
  DataTableErrorState,
  DataTablePaginationState,
  DataTableRowActions,
  DataTableSorting,
  SortState,
} from './DataTable.types';

const alignmentClasses: Record<DataTableColumnAlignment, string> = {
  start: 'text-left',
  center: 'text-center',
  end: 'text-right',
};

const sortableAlignmentClasses: Record<DataTableColumnAlignment, string> = {
  start: 'justify-start text-left',
  center: 'justify-center text-center',
  end: 'justify-end text-right',
};

const priorityClasses: Record<DataTableColumnPriority, string> = {
  primary: '',
  secondary: 'hidden sm:table-cell',
  tertiary: 'hidden md:table-cell',
};

export type DataTableProps<T> = {
  caption: string;
  rows: readonly T[];
  columns: readonly DataTableColumn<T>[];
  getRowId: (row: T) => string;
  sorting?: DataTableSorting;
  rowActions?: DataTableRowActions<T>;
  toolbar?: ReactNode;
  pagination?: DataTablePaginationState;
  loading?: boolean;
  loadingMessage?: string;
  error?: DataTableErrorState | null;
  emptyState: DataTableEmptyState;
  filteredEmptyState?: DataTableEmptyState;
  isFiltered?: boolean;
};

function getNextSortState(
  columnId: string,
  currentState: SortState,
): SortState {
  if (!currentState || currentState.columnId !== columnId) {
    return { columnId, direction: 'asc' };
  }

  if (currentState.direction === 'asc') {
    return { columnId, direction: 'desc' };
  }

  return null;
}

function getColumnStyle(minWidth?: number): CSSProperties | undefined {
  return minWidth === undefined ? undefined : { minWidth };
}

export default function DataTable<T>({
  caption,
  rows,
  columns,
  getRowId,
  sorting,
  rowActions,
  toolbar,
  pagination,
  loading = false,
  loadingMessage = 'Cargando registros...',
  error = null,
  emptyState,
  filteredEmptyState,
  isFiltered = false,
}: DataTableProps<T>) {
  const emptyContent =
    isFiltered && filteredEmptyState ? filteredEmptyState : emptyState;

  return (
    <div className="space-y-4">
      {toolbar}

      {loading ? (
        <Loading message={loadingMessage} />
      ) : error ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-danger bg-danger-subtle p-4 text-danger sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{error.message}</span>
          {error.onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={error.onRetry}
            >
              {error.retryLabel ?? 'Reintentar'}
            </Button>
          ) : null}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={emptyContent.title}
          description={emptyContent.description}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <caption className="sr-only">{caption}</caption>
              <thead className="bg-surface-subtle">
                <tr>
                  {columns.map((column) => {
                    const align = column.align ?? 'start';
                    const priority = column.priority ?? 'primary';
                    const currentSort =
                      sorting?.state?.columnId === column.id
                        ? sorting.state
                        : null;
                    const ariaSort =
                      column.sortable && currentSort
                        ? currentSort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined;

                    return (
                      <th
                        key={column.id}
                        scope="col"
                        aria-sort={ariaSort}
                        style={getColumnStyle(column.minWidth)}
                        className={[
                          'px-4 py-3 text-sm font-semibold text-text',
                          alignmentClasses[align],
                          priorityClasses[priority],
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {column.sortable && sorting ? (
                          <button
                            type="button"
                            className={[
                              'inline-flex w-full items-center gap-2 rounded-md',
                              'focus:outline-none focus:ring-2 focus:ring-focus-ring',
                              sortableAlignmentClasses[align],
                            ].join(' ')}
                            onClick={() =>
                              sorting.onChange(
                                getNextSortState(column.id, sorting.state),
                              )
                            }
                          >
                            <span>{column.header}</span>
                            {currentSort?.direction === 'asc' ? (
                              <ArrowUp aria-hidden="true" size={15} />
                            ) : currentSort?.direction === 'desc' ? (
                              <ArrowDown aria-hidden="true" size={15} />
                            ) : (
                              <ChevronsUpDown aria-hidden="true" size={15} />
                            )}
                          </button>
                        ) : (
                          column.header
                        )}
                      </th>
                    );
                  })}

                  {rowActions ? (
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-sm font-semibold text-text"
                    >
                      Acciones
                    </th>
                  ) : null}
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr
                    key={getRowId(row)}
                    className="border-t border-border transition-colors hover:bg-surface-subtle"
                  >
                    {columns.map((column) => {
                      const align = column.align ?? 'start';
                      const priority = column.priority ?? 'primary';

                      return (
                        <td
                          key={column.id}
                          style={getColumnStyle(column.minWidth)}
                          className={[
                            'px-4 py-3 text-sm text-text',
                            alignmentClasses[align],
                            priorityClasses[priority],
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {column.cell(row)}
                        </td>
                      );
                    })}

                    {rowActions ? (
                      <td className="px-4 py-3 text-right">
                        <RowActionsMenu
                          row={row}
                          label={rowActions.label(row)}
                          actions={rowActions.actions}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination ? <DataTablePagination {...pagination} /> : null}
        </div>
      )}
    </div>
  );
}
