export type ClientTableSortDirection = 'asc' | 'desc';

export function stableSort<T>(
  rows: readonly T[],
  comparator: (first: T, second: T) => number,
  direction: ClientTableSortDirection,
): T[] {
  const directionMultiplier = direction === 'asc' ? 1 : -1;

  return rows
    .map((row, originalIndex) => ({ row, originalIndex }))
    .sort((first, second) => {
      const comparison = comparator(first.row, second.row);

      return comparison === 0
        ? first.originalIndex - second.originalIndex
        : comparison * directionMultiplier;
    })
    .map(({ row }) => row);
}

export function paginateRows<T>(
  rows: readonly T[],
  pageIndex: number,
  pageSize: number,
): T[] {
  const start = pageIndex * pageSize;

  return rows.slice(start, start + pageSize);
}
