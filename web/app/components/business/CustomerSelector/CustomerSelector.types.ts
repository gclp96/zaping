export interface CustomerOption {
  id: string;
  name: string;

  type?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;

  isActive?: boolean;
}

export interface CustomerSelectorProps {
  options: CustomerOption[];

  value: string;
  onChange: (customerId: string) => void;

  onCreateNew?: () => void;

  label?: string;
  name?: string;
  placeholder?: string;

  loading?: boolean;
  disabled?: boolean;
  required?: boolean;

  error?: string;
  helperText?: string;
}