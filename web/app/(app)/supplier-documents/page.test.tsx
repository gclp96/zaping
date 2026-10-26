import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/services/api";
import { clearAuthenticatedSessionCache } from "@/app/auth-session";
import {
  listSupplierDocuments,
  createSupplierDocument,
} from "@/services/supplier-documents";
import SupplierDocumentsPage from "./page";

vi.mock("@/services/api", () => ({ api: { get: vi.fn() } }));
vi.mock("@/services/supplier-documents", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/services/supplier-documents")>();
  return { ...real, listSupplierDocuments: vi.fn(), createSupplierDocument: vi.fn() };
});

const auth = (role: string) => ({
  data: {
    id: "actor", companyId: "company-1", firstName: "User",
    lastName: "Test", email: "test@example.invalid",
    role, companyTimezone: "America/Hermosillo",
  },
});

beforeEach(() => {
  clearAuthenticatedSessionCache();
  vi.clearAllMocks();
  vi.mocked(listSupplierDocuments).mockResolvedValue([{
    id: "doc-1", supplierId: "supplier-1", type: "FACTURA",
    series: "A", number: "4618",
    status: "ACTIVE", basisStatus: "PENDING_REVIEW", revision: 0,
    documentDate: "2026-10-16T00:00:00.000Z",
    currency: "MXN", totalAmount: "1160.00",
    subtotalAmount: "1000.00", ivaAmount: "160.00",
    goodsNetAmount: null, freightAmount: null, discountAmount: null,
    cfdiUuid: null, issuerRfc: null, receiverRfc: null,
    taxBreakdowns: [], identityOccurrence: 1,
    replacedByDocumentId: null, cancellationReason: null,
    createdAt: "2026-10-16T12:00:00.000Z",
  }]);
  vi.mocked(api.get).mockImplementation(async (url) => String(url) === "/auth/me"
    ? auth("ADMIN") as never
    : { data: [{ id: "supplier-1", name: "Distribuidora Médica" }] } as never);
  vi.mocked(createSupplierDocument).mockResolvedValue({ id: "doc-1" } as never);
});

afterEach(() => cleanup());

describe("R2A-03 supplier documents", () => {
  it("shows invoice status and missing basis without auto-confirmation", async () => {
    render(<SupplierDocumentsPage />);
    expect(await screen.findByText("A-4618")).toBeTruthy();
    expect(screen.getByText("Pendiente de revisión")).toBeTruthy();
    expect(screen.getByText("1,160.00 MXN")).toBeTruthy();
  });

  it.each(["SALES", "WAREHOUSE"])("does not fetch tax documents for %s", async (role) => {
    vi.mocked(api.get).mockResolvedValue(auth(role) as never);
    render(<SupplierDocumentsPage />);
    expect(await screen.findByText("Sin permisos")).toBeTruthy();
    await waitFor(() => expect(listSupplierDocuments).not.toHaveBeenCalled());
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
