import type { CSSProperties, Key, ReactNode } from 'react';

export type StaticTableColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'start' | 'center' | 'end';
  minWidth?: number;
};

export type StaticTableProps<T> = {
  columns: readonly StaticTableColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => Key;
  caption?: string;
  emptyState?: ReactNode;
};

const alignmentClasses: Record<
  NonNullable<StaticTableColumn<unknown>['align']>,
  string
> = {
  start: 'text-left',
  center: 'text-center',
  end: 'text-right',
};

function getColumnStyle(minWidth?: number): CSSProperties | undefined {
  return minWidth === undefined ? undefined : { minWidth };
}

export default function StaticTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
  emptyState = 'Sin registros',
}: StaticTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl bg-card shadow">
      <table className="w-full">
        {caption ? <caption className="sr-only">{caption}</caption> : null}

        <thead className="bg-muted">
          <tr>
            {columns.map((column) => {
              const align = column.align ?? 'start';

              return (
                <th
                  key={column.id}
                  scope="col"
                  style={getColumnStyle(column.minWidth)}
                  className={`p-4 font-semibold text-foreground ${alignmentClasses[align]}`}
                >
                  {column.header}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="p-4 text-center text-muted-foreground"
              >
                {emptyState}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className="border-t hover:bg-gray-50"
              >
                {columns.map((column) => {
                  const align = column.align ?? 'start';

                  return (
                    <td
                      key={column.id}
                      style={getColumnStyle(column.minWidth)}
                      className={`p-4 ${alignmentClasses[align]}`}
                    >
                      {column.cell(row)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
