import type { ChangeEvent } from 'react';

import Input from '../../ui/Input';

import type { DateInputProps } from './DateInput.types';

export default function DateInput({
  value,
  onValueChange,
  ...inputProps
}: DateInputProps) {
  function handleChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    onValueChange(event.target.value);
  }

  return (
    <Input
      {...inputProps}
      type="date"
      value={value}
      onChange={handleChange}
    />
  );
}