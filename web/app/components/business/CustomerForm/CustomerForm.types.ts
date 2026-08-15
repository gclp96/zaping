export type CustomerFormCustomer = {
  id: string;
  name: string;
  type: string;
  email: string;
  phone: string;
  address?: string | null;
  contactName?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export type CustomerFormValues = {
  name: string;
  type: string;
  email: string;
  phone: string;
  address: string;
  contactName: string;
  notes: string;
};

export type CustomerFormModalProps = {
  isOpen: boolean;

  customer?: CustomerFormCustomer | null;

  onClose: () => void;

  onSaved: (
    customer: CustomerFormCustomer,
  ) => void | Promise<void>;
};