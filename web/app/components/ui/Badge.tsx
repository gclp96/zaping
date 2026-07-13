import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export type BadgeColor = 'green' | 'yellow' | 'red' | 'blue' | 'gray';

type BadgeProps = Omit<ComponentPropsWithoutRef<'span'>, 'color'> & {
  color: BadgeColor;
  children: ReactNode;
};

const colors: Record<BadgeColor, string> = {
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-800',
};

export default function Badge({
  color,
  children,
  className = '',
  ...props
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full',
        'px-3 py-1 text-xs font-semibold',
        colors[color],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </span>
  );
}