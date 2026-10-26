import { BadRequestException } from '@nestjs/common';
import { SupplierDocumentType } from '@prisma/client';
import {
  createSupplierDocumentRequestHash, documentDate, documentMoney, normalizedIdentity,
} from './supplier-document-normalization';

describe('supplier-document normalization', () => {
  it('preserves leading zeros and separators', () => {
    expect(normalizedIdentity('  fac-0001  ')).toBe('FAC-0001');
    expect(normalizedIdentity('FAC0001')).not.toBe(normalizedIdentity('FAC-0001'));
  });
  it('rejects impossible civil dates', () => {
    expect(() => documentDate('2026-02-30')).toThrow(BadRequestException);
    expect(documentDate('2026-10-25').toISOString()).toBe('2026-10-25T00:00:00.000Z');
  });
  it('preserves cents and rejects excess precision', () => {
    expect(documentMoney('31840.01')?.toFixed(2)).toBe('31840.01');
    expect(() => documentMoney('1.234')).toThrow(BadRequestException);
  });
  it('hashes canonical amounts and case consistently', () => {
    const a = {
      supplierId:'99b98b5a-cf67-4c72-9b6b-8871312198c4',
      type:SupplierDocumentType.FACTURA, series:' a ', number:' 0001 ',
      documentDate:'2026-10-25', subtotalAmount:'100',
    };
    expect(createSupplierDocumentRequestHash(a)).toBe(
      createSupplierDocumentRequestHash({...a,series:'A',number:'0001',subtotalAmount:'100.00'}),
    );
  });
});
