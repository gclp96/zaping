import type { ReactNode } from 'react';

export type StatusTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

export interface StatusBadgeProps {
  label: string;
  tone: StatusTone;
  ariaLabel?: string;
  icon?: ReactNode;
  className?: string;
}