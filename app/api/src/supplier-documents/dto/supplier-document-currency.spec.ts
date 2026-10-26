import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  CreateSupplierDocumentDto,
  CreateSupplierDocumentExceptionDto,
} from './create-supplier-document.dto';
import {
  ApproveReceiptVarianceDto,
  ConfirmSupplierDocumentBasisDto,
  CorrectSupplierDocumentBasisDto,
} from './supplier-document-reconciliation.dto';

const contracts = [
  { name: 'create', dto: CreateSupplierDocumentDto, field: 'currency' },
  {
    name: 'exception',
    dto: CreateSupplierDocumentExceptionDto,
    field: 'currency',
  },
  { name: 'confirm', dto: ConfirmSupplierDocumentBasisDto, field: 'currency' },
  { name: 'correct', dto: CorrectSupplierDocumentBasisDto, field: 'currency' },
  {
    name: 'variance',
    dto: ApproveReceiptVarianceDto,
    field: 'receiptCurrency',
  },
];

describe('supplier document currency boundary (#135)', () => {
  for (const { name, dto, field } of contracts) {
    describe(name, () => {
      it.each(['MXN', 'USD'])('accepts %s', (currency) => {
        const errors = validateSync(
          Object.assign(new dto(), { [field]: currency }),
        );
        expect(errors.filter((error) => error.property === field)).toEqual([]);
      });
      it.each(['EUR', 'AAA', 'US', 'USDD', '', ' MXN ', 'MXN\n'])(
        'rejects %j',
        (currency) => {
          const errors = validateSync(
            Object.assign(new dto(), { [field]: currency }),
          );
          expect(errors.some((error) => error.property === field)).toBe(true);
        },
      );
    });
  }
});

describe('creation currency normalization', () => {
  it.each(['mxn', 'uSd'])('normalizes %s before API validation', (currency) => {
    const value = plainToInstance(CreateSupplierDocumentDto, { currency });
    expect(value.currency).toBe(currency.toUpperCase());
    expect(
      validateSync(value).filter((error) => error.property === 'currency'),
    ).toEqual([]);
  });
  it('preserves optional currency for documents without captured amounts', () => {
    expect(
      validateSync(new CreateSupplierDocumentDto()).filter(
        (error) => error.property === 'currency',
      ),
    ).toEqual([]);
  });
});
