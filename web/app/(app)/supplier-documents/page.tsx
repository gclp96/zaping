"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { FilePlus2, RefreshCw } from "lucide-react";
import axios from "axios";

import { useAuthenticatedSession } from "@/app/auth-session";
import { hasRole, MANAGEMENT_ROLES } from "@/app/erp-role-access";
import Button from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";
import CurrencySelect, { isSupportedCurrency } from "@/app/components/ui/CurrencySelect";
import ForbiddenState from "@/app/components/ui/ForbiddenState";
import Loading from "@/app/components/ui/Loading";
import PageContainer from "@/app/components/ui/layout/PageContainer";
import PageHeader from "@/app/components/ui/layout/PageHeader";
import Section from "@/app/components/ui/layout/Section";
import { api } from "@/services/api";
import { getApiErrorMessage, isForbiddenError } from "@/services/errors";
import {
  createSupplierDocument,
  createSupplierDocumentException,
  getSupplierDocument,
  documentDateLabel,
  documentTypeLabel,
  formatSupplierMoney,
  listSupplierDocuments,
  type NewSupplierDocument,
  type SupplierDocument,
  type SupplierDocumentType,
} from "@/services/supplier-documents";

type SupplierOption = { id: string; name: string };
const MONEY = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;
const basicInput = "w-full rounded-lg border border-gray-300 bg-white p-3 text-text focus:outline-none focus:ring-2 focus:ring-blue-500";

function emptyForm() {
  return {
    supplierId: "",
    type: "FACTURA" as SupplierDocumentType,
    series: "",
    number: "",
    documentDate: "",
    currency: "MXN",
    cfdiUuid: "",
    issuerRfc: "",
    receiverRfc: "",
    subtotalAmount: "",
    ivaAmount: "",
    totalAmount: "",
    goodsNetAmount: "",
  };
}

export default function SupplierDocumentsPage() {
  const session = useAuthenticatedSession();
  const role = session.status === "success" ? session.user.role : null;
  const hasAccess = hasRole(role, MANAGEMENT_ROLES);
  const [documents, setDocuments] = useState<SupplierDocument[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [exceptionCandidate, setExceptionCandidate] = useState<{
    payload: NewSupplierDocument;
    duplicateOf: SupplierDocument;
  } | null>(null);
  const [exceptionReason, setExceptionReason] = useState("");
  const [exceptionEvidence, setExceptionEvidence] = useState("");
  const exceptionRetry = useRef<{ signature: string; key: string } | null>(null);
  const retry = useRef<{ signature: string; key: string } | null>(null);

  useEffect(() => {
    if (session.status !== "success" || !hasAccess) return;
    let active = true;
    Promise.all([
      listSupplierDocuments(),
      api.get<SupplierOption[]>("/suppliers"),
    ])
      .then(([docs, suppliersResponse]) => {
        if (!active) return;
        setDocuments(docs);
        setSuppliers(suppliersResponse.data);
        setLoadError("");
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isForbiddenError(error)) setForbidden(true);
        setLoadError(getApiErrorMessage(error, "No fue posible cargar documentos."));
        setLoading(false);
      });
    return () => { active = false; };
  }, [hasAccess, session.status]);

  const supplierNames = useMemo(
    () => new Map(suppliers.map((item) => [item.id, item.name])),
    [suppliers],
  );
  const visible = useMemo(() => {
    const text = search.trim().toLocaleLowerCase("es-MX");
    if (!text) return documents;
    return documents.filter((doc) =>
      [doc.number, doc.series, doc.cfdiUuid, supplierNames.get(doc.supplierId)]
        .some((value) => value?.toLocaleLowerCase("es-MX").includes(text)),
    );
  }, [documents, search, supplierNames]);

  async function refresh() {
    try {
      setLoadError("");
      const [result, suppliersResponse] = await Promise.all([
        listSupplierDocuments(),
        api.get<SupplierOption[]>("/suppliers"),
      ]);
      setDocuments(result);
      setSuppliers(suppliersResponse.data);
    } catch (error: unknown) {
      if (isForbiddenError(error)) setForbidden(true);
      setLoadError(getApiErrorMessage(error, "No fue posible actualizar documentos."));
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof ReturnType<typeof emptyForm>>(
    field: K, value: ReturnType<typeof emptyForm>[K],
  ) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setExceptionCandidate(null);
    setSaveError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const number = form.number.trim();
    if (!form.supplierId || !number || !/^\d{4}-\d{2}-\d{2}$/.test(form.documentDate)) {
      setSaveError("Selecciona un proveedor, folio y fecha.");
      return;
    }
    const moneyFields = [
      form.subtotalAmount, form.ivaAmount, form.totalAmount, form.goodsNetAmount,
    ].filter(Boolean);
    if (moneyFields.some((value) => !MONEY.test(value))) {
      setSaveError("Los importes deben ser positivos o cero y contener máximo dos decimales.");
      return;
    }
    if (!isSupportedCurrency(form.currency)) {
      setSaveError("Selecciona MXN o USD.");
      return;
    }
    const payload: NewSupplierDocument = {
      supplierId: form.supplierId,
      type: form.type,
      number,
      documentDate: form.documentDate,
    };
    const fields = [
      "series", "currency", "subtotalAmount", "ivaAmount", "totalAmount",
      ...(form.type === "FACTURA"
        ? ["cfdiUuid", "issuerRfc", "receiverRfc", "goodsNetAmount"] as const
        : []),
    ] as const;
    for (const field of fields) {
      const value = form[field].trim();
      if (value) Object.assign(payload, { [field]: value });
    }
    const signature = JSON.stringify(payload);
    if (!retry.current || retry.current.signature !== signature) {
      retry.current = { signature, key: crypto.randomUUID() };
    }
    try {
      setSaving(true);
      setSaveError("");
      await createSupplierDocument(payload, retry.current.key);
      retry.current = null;
      setExceptionCandidate(null);
      setForm(emptyForm());
      setCreating(false);
      await refresh();
    } catch (error: unknown) {
      const body = axios.isAxiosError(error) ? error.response?.data as
        { code?: string; existingDocumentId?: string } | undefined : undefined;
      if (error && axios.isAxiosError(error) &&
          error.response?.status === 409 &&
          body?.code === "SUPPLIER_DOCUMENT_IDENTITY_EXISTS" &&
          body.existingDocumentId) {
        try {
          const candidate = await getSupplierDocument(body.existingDocumentId);
          const norm = (value: string | null | undefined) =>
            (value ?? "").trim().normalize("NFC").toUpperCase();
          if (candidate.identityOccurrence !== 1 ||
              candidate.supplierId !== payload.supplierId ||
              candidate.type !== payload.type ||
              norm(candidate.series) !== norm(payload.series) ||
              norm(candidate.number) !== norm(payload.number)) {
            throw new Error("La identidad no coincide con el documento encontrado.");
          }
          setExceptionCandidate({ payload, duplicateOf: candidate });
          setExceptionReason("");
          setExceptionEvidence("");
          exceptionRetry.current = null;
          setSaveError("Ya existe ese folio. Verifica el documento previo; solo registra una excepción si es un documento comercial realmente distinto.");
        } catch {
          setExceptionCandidate(null);
          setSaveError("Existe un conflicto de identidad, pero no fue posible verificar la referencia. Revisa la captura.");
        }
      } else {
        setExceptionCandidate(null);
        setSaveError(getApiErrorMessage(error, "No fue posible registrar el documento."));
      }
    } finally {
      setSaving(false);
    }
  }

  async function submitException() {
    if (!exceptionCandidate || saving || exceptionReason.trim().length < 10 ||
        exceptionEvidence.trim().length < 5) {
      setSaveError("Para autorizar esta excepción indica motivo (mínimo 10 caracteres) y referencia de evidencia (mínimo 5).");
      return;
    }
    const request = {
      ...exceptionCandidate.payload,
      duplicateOfDocumentId: exceptionCandidate.duplicateOf.id,
      reason: exceptionReason.trim(),
      evidenceReference: exceptionEvidence.trim(),
    };
    const signature = JSON.stringify(request);
    if (!exceptionRetry.current || exceptionRetry.current.signature !== signature) {
      exceptionRetry.current = { signature, key: crypto.randomUUID() };
    }
    setSaving(true);
    try {
      setSaveError("");
      await createSupplierDocumentException(request, exceptionRetry.current.key);
    } catch (error: unknown) {
      setSaveError(getApiErrorMessage(error, "No se pudo registrar la excepción."));
      setSaving(false);
      return;
    }
    exceptionRetry.current = null;
    retry.current = null;
    setExceptionCandidate(null);
    setExceptionReason("");
    setExceptionEvidence("");
    setForm(emptyForm());
    setCreating(false);
    setSaving(false);
    await refresh();
  }

  if (session.status === "loading") return <PageContainer><Loading message="Verificando sesión..." /></PageContainer>;
  if (session.status === "success" && !hasAccess) {
    return <PageContainer><ForbiddenState /></PageContainer>;
  }
  if (session.status !== "success") {
    return <PageContainer><p role="alert">No fue posible verificar la sesión.</p></PageContainer>;
  }
  if (forbidden) return <PageContainer><ForbiddenState /></PageContainer>;

  return (
    <PageContainer>
      <PageHeader
        title="Documentos de proveedor"
        description="Facturas, remisiones y notas de entrega. La captura no valida CFDI ante el SAT ni modifica inventario."
        action={
          <Button type="button" onClick={() => {
            setCreating((v) => !v);
            setSaveError("");
            setExceptionCandidate(null);
            setExceptionReason("");
            setExceptionEvidence("");
            exceptionRetry.current = null;
          }}>
            <FilePlus2 aria-hidden="true" size={18} />
            {creating ? "Cerrar captura" : "Nuevo documento"}
          </Button>
        }
      />
      {creating && (
        <Section title="Registrar documento del proveedor">
          <form onSubmit={(event) => void submit(event)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block text-sm font-medium">
                Proveedor *
                <select aria-label="Proveedor" className={basicInput} value={form.supplierId}
                  onChange={(event) => updateField("supplierId", event.target.value)} required>
                  <option value="">Seleccionar proveedor</option>
                  {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Tipo *
                <select aria-label="Tipo de documento" className={basicInput} value={form.type}
                  onChange={(event) => updateField("type", event.target.value as SupplierDocumentType)}>
                  <option value="FACTURA">Factura</option>
                  <option value="REMISION">Remisión</option>
                  <option value="NOTA_ENTREGA">Nota de entrega</option>
                </select>
              </label>
              <Input label="Fecha del documento" required type="date" value={form.documentDate}
                onChange={(event) => updateField("documentDate", event.target.value)} />
              <Input label="Serie" maxLength={80} value={form.series}
                onChange={(event) => updateField("series", event.target.value)} />
              <Input label="Folio / número" maxLength={160} required value={form.number}
                onChange={(event) => updateField("number", event.target.value)} />
              <CurrencySelect label="Moneda" value={form.currency} required
                onChange={(value) => updateField("currency", value)} />
              {form.type === "FACTURA" && (
                <>
                  <Input label="UUID CFDI (si está disponible)" value={form.cfdiUuid}
                    onChange={(event) => updateField("cfdiUuid", event.target.value)} />
                  <Input label="RFC emisor" maxLength={13} value={form.issuerRfc}
                    onChange={(event) => updateField("issuerRfc", event.target.value.toUpperCase())} />
                  <Input label="RFC receptor" maxLength={13} value={form.receiverRfc}
                    onChange={(event) => updateField("receiverRfc", event.target.value.toUpperCase())} />
                </>
              )}
              <Input label="Subtotal" inputMode="decimal" value={form.subtotalAmount}
                onChange={(event) => updateField("subtotalAmount", event.target.value)} />
              <Input label="IVA" inputMode="decimal" value={form.ivaAmount}
                onChange={(event) => updateField("ivaAmount", event.target.value)} />
              <Input label="Total" inputMode="decimal" value={form.totalAmount}
                onChange={(event) => updateField("totalAmount", event.target.value)} />
              {form.type === "FACTURA" && (
                <Input label="Base neta de mercancía (por revisar)" inputMode="decimal"
                  helperText="Importe de productos después de descuentos de mercancía, sin IVA, retenciones ni flete separado. Ejemplo: productos $1,000 − descuento $100 = base $900. Se confirma antes de conciliar."
                  value={form.goodsNetAmount}
                  onChange={(event) => updateField("goodsNetAmount", event.target.value)} />
              )}
            </div>
            <p className="text-sm text-text-muted">Los importes no informados quedan sin capturar, nunca se interpretan como cero.</p>
            {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
            <Button type="submit" loading={saving}>Guardar documento</Button>
          </form>
        </Section>
      )}
      {creating && exceptionCandidate && (
        <Section title="Excepción administrativa por folio repetido">
          <p className="text-sm text-text-muted">
            Existe el documento {[exceptionCandidate.duplicateOf.series,
              exceptionCandidate.duplicateOf.number].filter(Boolean).join("-")}.
            Esta excepción no debe utilizarse para duplicar capturas ni cuando el UUID fiscal ya exista.
          </p>
          <Link className="text-blue-700 underline" href={
            "/supplier-documents/" + encodeURIComponent(exceptionCandidate.duplicateOf.id)
          }>Consultar el documento existente</Link>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Input label="Motivo excepcional" minLength={10} required
              value={exceptionReason} onChange={(event) => setExceptionReason(event.target.value)} />
            <Input label="Referencia de evidencia" minLength={5} required
              value={exceptionEvidence} onChange={(event) => setExceptionEvidence(event.target.value)} />
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button type="button" disabled={saving} onClick={() => void submitException()}>
              Registrar excepción auditada
            </Button>
            <Button type="button" variant="outline" disabled={saving}
              onClick={() => setExceptionCandidate(null)}>No duplicar documento</Button>
          </div>
        </Section>
      )}
      {loadError && (
        <div role="alert" className="my-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {loadError} <Button type="button" variant="outline" onClick={() => void refresh()}>Reintentar</Button>
        </div>
      )}
      {loading ? <Loading message="Cargando documentos..." /> : (
        <Section title="Documentos registrados" description="Últimos 50 documentos disponibles en la API.">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-60 flex-1">
              <Input label="Buscar por proveedor, folio o UUID" type="search" value={search}
                onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Button type="button" variant="outline" onClick={() => void refresh()}>
              <RefreshCw aria-hidden="true" size={16} /> Actualizar
            </Button>
          </div>
          {visible.length === 0 ? (
            <p className="rounded-lg border border-border bg-surface p-6 text-text-muted">
              No hay documentos que coincidan con la búsqueda.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-surface-subtle text-text-muted">
                  <tr>
                    <th scope="col" className="p-3">Folio</th>
                    <th scope="col" className="p-3">Proveedor</th>
                    <th scope="col" className="p-3">Tipo</th>
                    <th scope="col" className="p-3">Fecha</th>
                    <th scope="col" className="p-3">Total</th>
                    <th scope="col" className="p-3">Control</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((doc) => (
                    <tr key={doc.id} className="border-t border-border">
                      <td className="p-3 font-semibold">
                        <Link className="text-blue-700 underline" href={"/supplier-documents/" + encodeURIComponent(doc.id)}>
                          {[doc.series, doc.number].filter(Boolean).join("-")}
                        </Link>
                        <p className="mt-1 text-xs font-normal text-text-muted">
                          Serie: {doc.series || "Sin serie"} · Número: {doc.number}
                        </p>
                      </td>
                      <td className="p-3">{supplierNames.get(doc.supplierId) ?? "Proveedor no disponible"}</td>
                      <td className="p-3">{documentTypeLabel(doc.type)}</td>
                      <td className="p-3">{documentDateLabel(doc.documentDate)}</td>
                      <td className="p-3 tabular-nums">{formatSupplierMoney(doc.totalAmount, doc.currency)}</td>
                      <td className="p-3">
                        {doc.status === "CANCELLED"
                          ? "Cancelado"
                          : doc.type !== "FACTURA"
                            ? "Registrado · Sin conciliación monetaria"
                            : doc.basisStatus === "CONFIRMED"
                              ? "Base confirmada"
                              : "Pendiente de revisión"}
                        {doc.identityOccurrence > 1 && (
                          <p className="text-xs text-amber-800">
                            Excepción de folio #{doc.identityOccurrence}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}
    </PageContainer>
  );
}
