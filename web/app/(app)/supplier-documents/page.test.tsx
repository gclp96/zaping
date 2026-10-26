import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/services/api";
import { clearAuthenticatedSessionCache } from "@/app/auth-session";
import {
  listSupplierDocuments,
  createSupplierDocument,
  createSupplierDocumentException,
  getSupplierDocument,
} from "@/services/supplier-documents";
import SupplierDocumentsPage from "./page";

vi.mock("@/services/api", () => ({ api: { get: vi.fn() } }));
vi.mock("@/services/supplier-documents", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/services/supplier-documents")>();
  return { ...real, listSupplierDocuments: vi.fn(), createSupplierDocument: vi.fn(),
    getSupplierDocument: vi.fn(), createSupplierDocumentException: vi.fn() };
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

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("R2A-03 supplier documents", () => {
  it("shows invoice status and missing basis without auto-confirmation", async () => {
    render(<SupplierDocumentsPage />);
    expect(await screen.findByText("A-4618")).toBeTruthy();
    expect(screen.getByText("Pendiente de revisión")).toBeTruthy();
    expect(screen.getByText("1,160.00 MXN")).toBeTruthy();
  });

  it("shows the exception only after a verified duplicate identity and requires evidence", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "test-idempotency-key" });
    vi.mocked(createSupplierDocument).mockRejectedValue(
      Object.assign(new Error("El folio ya existe"), {
        isAxiosError: true,
        response: {
          status: 409,
          data: {
            code: "SUPPLIER_DOCUMENT_IDENTITY_EXISTS",
            existingDocumentId: "doc-original",
          },
        },
      }),
    );
    vi.mocked(getSupplierDocument).mockResolvedValue({
      id: "doc-original", supplierId: "supplier-1",
      type: "FACTURA", series: "A", number: "4618", identityOccurrence: 1,
    } as never);
    vi.mocked(createSupplierDocumentException).mockResolvedValue({
      id: "doc-new",
    } as never);
    const user = userEvent.setup();
    render(<SupplierDocumentsPage />);
    await screen.findByText("A-4618");
    expect(screen.queryByText("Excepción administrativa por folio repetido")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Nuevo documento" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Proveedor" }), "supplier-1");
    await user.type(screen.getByRole("textbox", { name: "Serie" }), "A");
    await user.type(screen.getByRole("textbox", { name: "Folio / número" }), "4618");
    fireEvent.change(screen.getByLabelText(/Fecha del documento/), {
      target: { value: "2026-10-16" },
    });
    await user.click(screen.getByRole("button", { name: "Guardar documento" }));
    expect(await screen.findByText(/Ya existe ese folio/)).toBeTruthy();
    expect(screen.getByText("Excepción administrativa por folio repetido")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Consultar el documento existente" })
      .getAttribute("href")).toBe("/supplier-documents/doc-original");
    expect(createSupplierDocumentException).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cerrar captura" }));
    await user.click(screen.getByRole("button", { name: "Nuevo documento" }));
    expect(screen.queryByText("Excepción administrativa por folio repetido")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Guardar documento" }));
    expect(await screen.findByText("Excepción administrativa por folio repetido")).toBeTruthy();
    await user.type(screen.getByRole("textbox", { name: "Motivo excepcional" }),
      "Envío nuevo, folio legítimamente repetido");
    await user.type(screen.getByRole("textbox", { name: "Referencia de evidencia" }),
      "Remisión firmada distinta");
    await user.click(screen.getByRole("button", { name: "Registrar excepción auditada" }));
    await waitFor(() => {
      expect(createSupplierDocumentException).toHaveBeenCalledWith(
        expect.objectContaining({
          number: "4618",
          duplicateOfDocumentId: "doc-original",
          evidenceReference: "Remisión firmada distinta",
        }),
        "test-idempotency-key",
      );
    });
  });

  it.each(["SALES", "WAREHOUSE"])("does not fetch tax documents for %s", async (role) => {
    vi.mocked(api.get).mockResolvedValue(auth(role) as never);
    render(<SupplierDocumentsPage />);
    expect(await screen.findByText("Sin permisos")).toBeTruthy();
    await waitFor(() => expect(listSupplierDocuments).not.toHaveBeenCalled());
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
