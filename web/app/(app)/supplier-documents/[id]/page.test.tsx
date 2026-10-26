import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/services/api";
import { clearAuthenticatedSessionCache } from "@/app/auth-session";
import {
  getSupplierDocument, getDocumentAllocations, listSupplierDocuments,
  correctSupplierDocumentBasis,
} from "@/services/supplier-documents";
import SupplierDocumentDetailPage from "./page";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "doc-1" }) }));
vi.mock("@/services/api", () => ({ api: { get: vi.fn() } }));
vi.mock("@/services/supplier-documents", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/services/supplier-documents")>();
  return {
    ...real,
    getSupplierDocument: vi.fn(), getDocumentAllocations: vi.fn(),
    listSupplierDocuments: vi.fn(), correctSupplierDocumentBasis: vi.fn(),
  };
});

const authenticated = (role: string) => ({
  data: {
    id: "user-1", companyId: "company-1", role,
    firstName: "QA", lastName: "Test", email: "qa@example.invalid",
    companyTimezone: "America/Hermosillo",
  },
});

beforeEach(() => {
  clearAuthenticatedSessionCache();
  vi.clearAllMocks();
  vi.mocked(getSupplierDocument).mockResolvedValue({
    id: "doc-1",
    supplierId: "supplier-1",
    type: "FACTURA",
    series: "A",
    number: "4618",
    documentDate: "2026-10-16T00:00:00Z",
    status: "ACTIVE",
    basisStatus: "PENDING_REVIEW",
    revision: 0,
    currency: "MXN",
    cfdiUuid: null,
    issuerRfc: null,
    receiverRfc: null,
    subtotalAmount: "1000.00",
    discountAmount: null,
    freightAmount: null,
    ivaAmount: "160.00",
    totalAmount: "1160.00",
    goodsNetAmount: null,
    taxBreakdowns: [],
    identityOccurrence: 1,
    replacedByDocumentId: null,
    cancellationReason: null,
    createdAt: "2026-10-16T01:00:00Z",
    audits: [{
      id: "audit-1", operation: "DOCUMENT_CREATED", revisionAfter: 0,
      reason: null, change: {}, createdAt: "2026-10-16T01:00:00Z",
    }],
  });
  vi.mocked(getDocumentAllocations).mockResolvedValue([]);
  vi.mocked(listSupplierDocuments).mockResolvedValue([]);
  vi.mocked(api.get).mockImplementation(async (path) =>
    String(path) === "/auth/me" ? authenticated("ADMIN") as never : { data: [] } as never);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("R2A-03 supplier document detail", () => {
  it("displays an unconfirmed basis, historical audit and controls without assuming SAT verification", async () => {
    render(<SupplierDocumentDetailPage />);
    expect(await screen.findByText("Documento A-4618")).toBeTruthy();
    expect(screen.getByText("Pendiente de revisión")).toBeTruthy();
    expect(screen.getByText("DOCUMENT_CREATED")).toBeTruthy();
    expect(screen.getByText("Sin recepciones vinculadas.")).toBeTruthy();
    expect(screen.getByText(/Zaping no realiza timbrado/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirmar base revisada" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Vincular recepción" })).toBeNull();
  });

  it("shows correction only for confirmed invoices and sends expected revision", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "correction-operation-key" });
    const initial = await getSupplierDocument("doc-1");
    vi.mocked(getSupplierDocument).mockResolvedValue({
      ...initial,
      basisStatus: "CONFIRMED",
      goodsNetAmount: "90.00",
      revision: 3,
    });
    vi.mocked(correctSupplierDocumentBasis).mockResolvedValue({
      eventId: "event-1", documentId: "doc-1",
      revision: 4, operation: "DOCUMENT_CORRECTED", change: {},
    });
    const user = userEvent.setup();
    render(<SupplierDocumentDetailPage />);
    expect(await screen.findByText("Documento A-4618")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guardar corrección de base" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmar base revisada" })).toBeNull();
    const input = screen.getByRole("textbox", { name: "Base neta corregida" });
    await user.clear(input);
    await user.type(input, "85.50");
    await user.type(
      screen.getByRole("textbox", { name: "Justificación de corrección" }),
      "Corrección por factura revisada",
    );
    await user.click(screen.getByRole("button", { name: "Guardar corrección de base" }));
    await waitFor(() => expect(correctSupplierDocumentBasis).toHaveBeenCalledWith(
      "doc-1",
      expect.objectContaining({
        goodsNetAmount: "85.50",
        currency: "MXN",
        expectedRevision: 3,
        reason: "Corrección por factura revisada",
      }),
      "correction-operation-key",
    ));
  });

  it.each(["WAREHOUSE", "SALES"])("does not fetch tax documents for %s", async (role) => {
    vi.mocked(api.get).mockResolvedValue(authenticated(role) as never);
    render(<SupplierDocumentDetailPage />);
    expect(await screen.findByText("Sin permisos")).toBeTruthy();
    await waitFor(() => expect(getSupplierDocument).not.toHaveBeenCalled());
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
