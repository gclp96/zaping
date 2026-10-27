import { describe, expect, it } from 'vitest';

import {
  formatReceiptFileSize,
  RECEIPT_FILE_MAX_BYTES,
  validateReceiptFileMetadata,
} from './receipt-file-preview';

describe('validación preliminar de adjuntos de recepciones', () => {
  it('admite PDF y JPEG con tipo declarado coherente', () => {
    expect(
      validateReceiptFileMetadata({
        name: 'factura.PDF',
        type: 'application/pdf',
        size: 1024,
      }),
    ).toEqual({ ok: true, category: 'PDF' });

    expect(
      validateReceiptFileMetadata({
        name: 'entrega.jpeg',
        type: 'image/jpeg',
        size: 2048,
      }),
    ).toEqual({ ok: true, category: 'JPG' });
  });

  it('rechaza extensiones ajenas, tipo contradictorio y archivos vacíos', () => {
    const invalid = [
      { name: 'script.html', type: 'text/html', size: 100 },
      { name: 'archivo.pdf', type: 'image/jpeg', size: 100 },
      { name: 'imagen.jpg', type: 'application/pdf', size: 100 },
      { name: 'vacio.pdf', type: 'application/pdf', size: 0 },
    ];

    for (const file of invalid) {
      expect(validateReceiptFileMetadata(file).ok).toBe(false);
    }
  });

  it('rechaza archivos mayores a 10 MiB y admite exactamente el límite', () => {
    expect(
      validateReceiptFileMetadata({
        name: 'grande.pdf',
        type: 'application/pdf',
        size: RECEIPT_FILE_MAX_BYTES + 1,
      }).ok,
    ).toBe(false);
    expect(
      validateReceiptFileMetadata({
        name: 'limite.pdf',
        type: 'application/pdf',
        size: RECEIPT_FILE_MAX_BYTES,
      }).ok,
    ).toBe(true);
  });

  it('formatea tamaño de los metadatos de manera legible', () => {
    expect(formatReceiptFileSize(99)).toBe('99 B');
    expect(formatReceiptFileSize(1536)).toBe('1.5 KB');
    expect(formatReceiptFileSize(1048576)).toBe('1.0 MB');
  });
});
