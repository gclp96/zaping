'use client';

import type { ReactNode } from 'react';
import { RotateCcw, Search } from 'lucide-react';

import Button from '../Button';
import Input from '../Input';
import Select from '../Select';

import type {
  DataTableSearchControl,
  DataTableSelectFilter,
} from './DataTable.types';

export type DataTableToolbarProps = {
  search?: DataTableSearchControl;
  filters?: readonly DataTableSelectFilter[];
  onReset?: () => void;
  resetDisabled?: boolean;
  actions?: ReactNode;
};

export default function DataTableToolbar({
  search,
  filters = [],
  onReset,
  resetDisabled = false,
  actions,
}: DataTableToolbarProps) {
  return (
    <div
      role="group"
      aria-label="Controles de tabla"
      className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
    >
      <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {search ? (
          <Input
            label={search.label ?? 'Buscar'}
            type="search"
            value={search.value}
            placeholder={search.placeholder}
            startAdornment={<Search size={17} />}
            onChange={(event) => search.onChange(event.target.value)}
          />
        ) : null}

        {filters.map((filter) => (
          <Select
            key={filter.id}
            label={filter.label}
            value={filter.value}
            options={[...filter.options]}
            placeholder={filter.placeholder ?? 'Todas las opciones'}
            onChange={(event) => filter.onChange(event.target.value)}
          />
        ))}
      </div>

      {onReset || actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {onReset ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resetDisabled}
              onClick={onReset}
            >
              <RotateCcw aria-hidden="true" size={16} />
              Limpiar filtros
            </Button>
          ) : null}

          {actions}
        </div>
      ) : null}
    </div>
  );
}
