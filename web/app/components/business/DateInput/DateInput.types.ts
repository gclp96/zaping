import type { InputProps } from '../../ui/Input';

export type DateInputProps = Omit<
  InputProps,
  'type' | 'value' | 'onChange'
> & {
  value: string;
  onValueChange: (value: string) => void;
};