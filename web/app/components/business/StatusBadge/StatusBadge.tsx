import Badge, {
  type BadgeColor,
} from '../../ui/Badge';

import type {
  StatusBadgeProps,
  StatusTone,
} from './StatusBadge.types';

const toneToColor: Record<StatusTone, BadgeColor> = {
  neutral: 'gray',
  info: 'blue',
  success: 'green',
  warning: 'yellow',
  danger: 'red',
};

export default function StatusBadge({
  label,
  tone,
  ariaLabel,
  icon,
  className,
}: StatusBadgeProps) {
  return (
    <Badge
      color={toneToColor[tone]}
      className={className}
      aria-label={ariaLabel}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}

      <span>{label}</span>
    </Badge>
  );
}