import { api } from "./api";

export type SupplierDocumentType = "FACTURA" | "REMISION" | "NOTA_ENTREGA";
export type SupplierDocumentStatus = "ACTIVE" | "CANCELLED";
export type SupplierDocumentBasisStatus = "PENDING_REVIEW" | "CONFIRMED";

export type SupplierDocumentTaxLine = {
  id: string;
  area: "GOODS" | "SHIPPING" | "UNSPECIFIED";
  treatment: "TAXABLE_16" | "TAXABLE_0" | "EXEMPT";
  baseAmount: string;
  ivaAmount: string;
};

export type SupplierDocumentAudit = {
  id: string;
  operation: string;
  revisionAfter: number;
  reason: string | null;
  change: unknown;
  createdAt: string;
};

export type SupplierDocument = {
  id: string;
  supplierId: string;
  type: SupplierDocumentType;
  series: string | null;
  number: string;
  documentDate: string;
  status: SupplierDocumentStatus;
  basisStatus: SupplierDocumentBasisStatus;
  revision: number;
  currency: string | null;
  cfdiUuid: string | null;
  issuerRfc: string | null;
  receiverRfc: string | null;
  subtotalAmount: string | null;
  discountAmount: string | null;
  freightAmount: string | null;
  ivaAmount: string | null;
  totalAmount: string | null;
  goodsNetAmount: string | null;
  identityOccurrence: number;
  taxBreakdowns: SupplierDocumentTaxLine[];
  audits?: SupplierDocumentAudit[];
  replacedByDocumentId: string | null;
  cancellationReason: string | null;
  createdAt: string;
};

export type NewSupplierDocument = {
  supplierId: string;
  type: SupplierDocumentType;
  series?: string;
  number: string;
  documentDate: string;
  currency?: string;
  cfdiUuid?: string;
  issuerRfc?: string;
  receiverRfc?: string;
  subtotalAmount?: string;
  discountAmount?: string;
  freightAmount?: string;
  ivaAmount?: string;
  totalAmount?: string;
  goodsNetAmount?: string;
};

export type SupplierDocumentAllocation = {
  id: string;
  receiptId: string;
  purchaseId: string;
  documentId: string;
  allocatedSubtotal: string;
  isActive: boolean;
  revision: number;
  receipt: { id: string; folio: string; purchaseId: string };
};

export type ReceiptReconciliation = {
  receiptId: string;
  allocatedTotalAmount: string;
  activeInvoiceCount: number;
  snapshotHash: string;
  receiptReviewStatus: "REQUIRES_REVIEW" | "APPROVED_VARIANCE";
  receiptComparableNetAmount: string | null;
  approvedDifferenceAmount: string | null;
  receiptCurrency: string | null;
  automaticCoverageComplete: false;
  receiptCeilingVerified: false;
  approvalCurrent: boolean;
};

export type ReconciliationEvent = {
  eventId: string;
  documentId: string;
  revision: number;
  operation: string;
  change: unknown;
};

export function documentDateLabel(value: string): string {
  // @db.Date is serialized as an ISO timestamp. Preserve the civil date.
  return value.slice(0, 10);
}

export function documentTypeLabel(type: SupplierDocumentType): string {
  return {
    FACTURA: "Factura",
    REMISION: "Remisión",
    NOTA_ENTREGA: "Nota de entrega",
  }[type];
}

export function formatSupplierMoney(value: string | null, currency: string | null) {
  if (value === null) return "Sin capturar";
  // Never round Decimal(18,2) through JavaScript Number.
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value)) return value;
  const sign = value.startsWith("-") ? "-" : "";
  const positive = sign ? value.slice(1) : value;
  const [whole, cents = ""] = positive.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return sign + grouped + "." + cents.padEnd(2, "0") +
    (currency ? " " + currency : "");
}

export async function listSupplierDocuments(supplierId?: string) {
  const result = await api.get<SupplierDocument[]>("/supplier-documents", {
    params: supplierId ? { supplierId } : undefined,
  });
  return result.data;
}

export async function getSupplierDocument(id: string) {
  const result = await api.get<SupplierDocument>(
    "/supplier-documents/" + encodeURIComponent(id),
  );
  return result.data;
}

export async function createSupplierDocument(payload: NewSupplierDocument, key: string) {
  const result = await api.post<SupplierDocument>("/supplier-documents", payload, {
    headers: { "Idempotency-Key": key },
  });
  return result.data;
}

export async function getDocumentAllocations(id: string) {
  const result = await api.get<SupplierDocumentAllocation[]>(
    "/supplier-documents/" + encodeURIComponent(id) + "/allocations",
  );
  return result.data;
}

export async function confirmDocumentBasis(
  id: string, payload: { goodsNetAmount: string; currency: string; reason: string; expectedRevision: number }, key: string,
) {
  const result = await api.post<ReconciliationEvent>(
    "/supplier-documents/" + encodeURIComponent(id) + "/confirm-basis",
    payload, { headers: { "Idempotency-Key": key } },
  );
  return result.data;
}

export async function allocateSupplierInvoice(
  id: string, payload: { receiptId: string; allocatedSubtotal: string; expectedRevision: number }, key: string,
) {
  const result = await api.post<ReconciliationEvent>(
    "/supplier-documents/" + encodeURIComponent(id) + "/allocations",
    payload, { headers: { "Idempotency-Key": key } },
  );
  return result.data;
}

export async function getReceiptReconciliation(receiptId: string) {
  const result = await api.get<ReceiptReconciliation>(
    "/supplier-documents/receipts/" + encodeURIComponent(receiptId) + "/reconciliation",
  );
  return result.data;
}

export async function approveReceiptVariance(
  receiptId: string,
  payload: {
    receiptComparableNetAmount: string;
    receiptCurrency: string;
    evidenceReference: string;
    reason: string;
    expectedSnapshotHash: string;
  },
  key: string,
) {
  const result = await api.post(
    "/supplier-documents/receipts/" + encodeURIComponent(receiptId) + "/approve-variance",
    payload, { headers: { "Idempotency-Key": key } },
  );
  return result.data;
}

export async function reviseSupplierAllocation(
  id: string,
  payload: {
    allocationId: string;
    action: "REPLACE_AMOUNT" | "DEACTIVATE" | "REACTIVATE";
    allocatedSubtotal?: string;
    reason: string;
    expectedRevision: number;
    expectedAllocationRevision: number;
  },
  key: string,
) {
  const result = await api.post<ReconciliationEvent>(
    "/supplier-documents/" + encodeURIComponent(id) + "/allocations/revise",
    payload, { headers: { "Idempotency-Key": key } },
  );
  return result.data;
}

export async function cancelSupplierDocument(
  id: string,
  payload: {
    source: "INTERNAL_RECORD_ERROR" | "EXTERNAL_REPORTED";
    reason: string;
    evidenceReference?: string;
    replacedByDocumentId?: string;
    expectedRevision: number;
  },
  key: string,
) {
  const result = await api.post<ReconciliationEvent>(
    "/supplier-documents/" + encodeURIComponent(id) + "/cancel",
    payload, { headers: { "Idempotency-Key": key } },
  );
  return result.data;
}
