import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import {
  createSupplierDocument,
  documentDateLabel,
  documentTypeLabel,
  formatSupplierMoney,
  getReceiptReconciliation,
  listSupplierDocuments,
} from "./supplier-documents";

vi.mock("./api", () => ({ api: { get: vi.fn(), post: vi.fn() } }));

describe("supplier document API client", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves civil dates and distinguishes missing money from zero", () => {
    expect(documentDateLabel("2026-10-16T00:00:00.000Z")).toBe("2026-10-16");
    expect(formatSupplierMoney(null, "MXN")).toBe("Sin capturar");
    expect(formatSupplierMoney("0.00", "MXN")).toBe("0.00 MXN");
    expect(documentTypeLabel("NOTA_ENTREGA")).toBe("Nota de entrega");
  });

  it("never requests documents from a foreign company through query parameters", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    await listSupplierDocuments("supplier-1");
    expect(api.get).toHaveBeenCalledWith("/supplier-documents", {
      params: { supplierId: "supplier-1" },
    });
  });

  it("sends creation with a dedicated idempotency header", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: "document-1" } });
    await createSupplierDocument(
      { supplierId: "supplier-1", type: "FACTURA", number: "0007", documentDate: "2026-10-16" },
      "operation-id",
    );
    expect(api.post).toHaveBeenCalledWith(
      "/supplier-documents",
      expect.objectContaining({ number: "0007" }),
      { headers: { "Idempotency-Key": "operation-id" } },
    );
  });

  it("uses the receipt reconciliation route", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { receiptReviewStatus: "REQUIRES_REVIEW" } });
    await getReceiptReconciliation("receipt-1");
    expect(api.get).toHaveBeenCalledWith(
      "/supplier-documents/receipts/receipt-1/reconciliation",
    );
  });
});
