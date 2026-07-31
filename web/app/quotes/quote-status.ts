import type {
  QuoteStatus,
  QuoteStatusDescriptor,
} from './types';

const quoteStatusDescriptors: Record<
  QuoteStatus,
  QuoteStatusDescriptor
> = {
  DRAFT: {
    label: 'Borrador',
    tone: 'neutral',
  },

  CONFIRMED: {
    label: 'Aprobada',
    tone: 'success',
  },

  CANCELLED: {
    label: 'Cancelada',
    tone: 'danger',
  },
};

export function getQuoteStatusDescriptor(
  status: QuoteStatus,
): QuoteStatusDescriptor {
  return quoteStatusDescriptors[status];
}