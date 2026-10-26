import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreateSupplierDocumentDto,
  CreateSupplierDocumentExceptionDto,
} from './dto/create-supplier-document.dto';

export function normalizedIdentity(value: string): string {
  return value.normalize('NFC').trim().toUpperCase();
}

export function documentDate(value: string): Date {
  const date = new Date(value + 'T00:00:00.000Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException('Fecha de documento inválida');
  }
  return date;
}

export function documentMoney(
  value: string | undefined,
): Prisma.Decimal | null {
  if (value === undefined) return null;
  if (!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(value)) {
    throw new BadRequestException('Importe inválido (máximo dos decimales)');
  }
  return new Prisma.Decimal(value);
}

export function createSupplierDocumentRequestHash(
  dto: CreateSupplierDocumentDto | CreateSupplierDocumentExceptionDto,
): string {
  const extra =
    'duplicateOfDocumentId' in dto
      ? {
          duplicateOfDocumentId: dto.duplicateOfDocumentId,
          reason: dto.reason.trim(),
          evidenceReference: dto.evidenceReference.trim(),
        }
      : null;
  const canonical = {
    supplierId: dto.supplierId,
    type: dto.type,
    series: normalizedIdentity(dto.series ?? ''),
    number: normalizedIdentity(dto.number),
    date: dto.documentDate,
    cfdiUuid: dto.cfdiUuid?.toLowerCase() ?? null,
    issuerRfc: dto.issuerRfc?.toUpperCase() ?? null,
    receiverRfc: dto.receiverRfc?.toUpperCase() ?? null,
    currency: dto.currency?.toUpperCase() ?? null,
    amounts: [
      dto.subtotalAmount,
      dto.discountAmount,
      dto.freightAmount,
      dto.ivaAmount,
      dto.withholdingAmount,
      dto.totalAmount,
      dto.goodsNetAmount,
    ].map((v) => (v === undefined ? null : documentMoney(v)?.toFixed(2))),
    taxes: (dto.taxBreakdowns ?? [])
      .map((x) => ({
        area: x.area,
        treatment: x.treatment,
        base: documentMoney(x.baseAmount)?.toFixed(2),
        iva: documentMoney(x.ivaAmount)?.toFixed(2),
      }))
      .sort((a, b) =>
        (a.area + a.treatment).localeCompare(b.area + b.treatment),
      ),
    extra,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
