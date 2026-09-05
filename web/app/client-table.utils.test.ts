import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  paginateRows,
  stableSort,
} from './client-table.utils';

describe('stableSort', () => {
  it('ordena ascendente con el comparador proporcionado', () => {
    const rows = ['Zulu', 'Alpha', 'Mike'];

    expect(stableSort(rows, (first, second) => first.localeCompare(second), 'asc'))
      .toEqual(['Alpha', 'Mike', 'Zulu']);
  });

  it('ordena descendente con números sin conocer el dominio', () => {
    const rows = [3, 1, 2];

    expect(stableSort(rows, (first, second) => first - second, 'desc'))
      .toEqual([3, 2, 1]);
  });

  it('preserva la estabilidad y no muta el input', () => {
    const first = { group: 'same', id: 'first' };
    const second = { group: 'same', id: 'second' };
    const third = { group: 'other', id: 'third' };
    const rows = [first, second, third];

    const sorted = stableSort(
      rows,
      (left, right) => left.group.localeCompare(right.group),
      'asc',
    );

    expect(sorted).toEqual([third, first, second]);
    expect(rows).toEqual([first, second, third]);
    expect(sorted).not.toBe(rows);
  });

  it('maneja input vacío y de una fila', () => {
    expect(stableSort([], () => 0, 'asc')).toEqual([]);

    const row = { id: 'only' };
    expect(stableSort([row], () => 0, 'desc')).toEqual([row]);
  });
});

describe('paginateRows', () => {
  it('devuelve la primera página', () => {
    expect(paginateRows([1, 2, 3, 4, 5], 0, 2)).toEqual([1, 2]);
  });

  it('devuelve una página intermedia', () => {
    expect(paginateRows([1, 2, 3, 4, 5], 1, 2)).toEqual([3, 4]);
  });

  it('devuelve la última página parcial', () => {
    expect(paginateRows([1, 2, 3, 4, 5], 2, 2)).toEqual([5]);
  });

  it('devuelve todas las filas si pageSize supera el total y no muta el input', () => {
    const rows = [1, 2, 3];

    expect(paginateRows(rows, 0, 10)).toEqual(rows);
    expect(rows).toEqual([1, 2, 3]);
  });
});
