import type { InputProps } from '../../ui/Input';

export type MoneyInputProps = Omit<
  InputProps,
  | 'type'
  | 'value'
  | 'onChange'
  | 'inputMode'
  | 'startAdornment'
  | 'endAdornment'
> & {
  value: string;
  onValueChange: (value: string) => void;
  allowNegative?: boolean;
  maxDecimals?: number;
};