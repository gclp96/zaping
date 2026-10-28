export const RECEIPT_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const RECEIPT_FILE_MAX_COUNT = 5;

export type ReceiptFileCategory = 'PDF' | 'JPG';

export type LocalReceiptFile = {
  id: number;
  name: string;
  sizeBytes: number;
  category: ReceiptFileCategory;
};

export type ReceiptFileValidation =
  | { ok: true; category: ReceiptFileCategory }
  | { ok: false; reason: string };

/**
 * This is only an early UX check based on browser-reported metadata.
 * It MUST NOT be used to authorize uploads or infer that bytes are safe.
 */
export function validateReceiptFileMetadata(
  file: Pick<File, 'name' | 'size' | 'type'>,
): ReceiptFileValidation {
  const name = file.name.toLowerCase();
  const category: ReceiptFileCategory | null = name.endsWith('.pdf')
    ? 'PDF'
    : name.endsWith('.jpg') || name.endsWith('.jpeg')
      ? 'JPG'
      : null;

  if (!category) {
    return {
      ok: false,
      reason: 'Solo se admiten archivos PDF, JPG o JPEG.',
    };
  }

  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    return { ok: false, reason: 'El archivo debe contener información.' };
  }

  if (file.size > RECEIPT_FILE_MAX_BYTES) {
    return { ok: false, reason: 'El archivo supera el límite de 10 MB.' };
  }

  const expectedMime = category === 'PDF' ? 'application/pdf' : 'image/jpeg';
  // Some local/dragged files provide an empty MIME. The backend will verify
  // actual bytes when uploading becomes available; no upload exists here.
  if (file.type !== '' && file.type.toLowerCase() !== expectedMime) {
    return {
      ok: false,
      reason: 'La extensión y el tipo del archivo no coinciden.',
    };
  }

  return { ok: true, category };
}

export function formatReceiptFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
