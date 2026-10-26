"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { useAuthenticatedSession } from "@/app/auth-session";
import { hasRole, MANAGEMENT_ROLES } from "@/app/erp-role-access";
import Button from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";
import ForbiddenState from "@/app/components/ui/ForbiddenState";
import Loading from "@/app/components/ui/Loading";
import PageContainer from "@/app/components/ui/layout/PageContainer";
import PageHeader from "@/app/components/ui/layout/PageHeader";
import Section from "@/app/components/ui/layout/Section";
import { api } from "@/services/api";
import { getApiErrorMessage, isForbiddenError } from "@/services/errors";
import type { PurchaseReceiptListItem } from "@/app/(app)/purchase-receipts/types";
import {
  allocateSupplierInvoice,
  approveReceiptVariance,
  cancelSupplierDocument,
  confirmDocumentBasis,
  correctSupplierDocumentBasis,
  documentDateLabel,
  documentTypeLabel,
  formatSupplierMoney,
  getDocumentAllocations,
  getReceiptReconciliation,
  getSupplierDocument,
  listSupplierDocuments,
  reviseSupplierAllocation,
  type ReceiptReconciliation,
  type SupplierDocument,
  type SupplierDocumentAllocation,
} from "@/services/supplier-documents";

const MONEY = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;
const selectClass = "w-full rounded-lg border border-gray-300 bg-white p-3 text-text";
const inputReason = "Escribe una justificación comprobable.";

export default function SupplierDocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const session = useAuthenticatedSession();
  const role = session.status === "success" ? session.user.role : null;
  const allowed = hasRole(role, MANAGEMENT_ROLES);
  const [document, setDocument] = useState<SupplierDocument | null>(null);
  const [allocations, setAllocations] = useState<SupplierDocumentAllocation[]>([]);
  const [receipts, setReceipts] = useState<PurchaseReceiptListItem[]>([]);
  const [otherDocuments, setOtherDocuments] = useState<SupplierDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const pending = useRef(new Map<string, { signature: string; key: string }>());

  const [basisAmount, setBasisAmount] = useState("");
  const [basisCurrency, setBasisCurrency] = useState("MXN");
  const [basisReason, setBasisReason] = useState("");
  const [receiptId, setReceiptId] = useState("");
  const [allocationAmount, setAllocationAmount] = useState("");
  const [revisionId, setRevisionId] = useState("");
  const [revisionAction, setRevisionAction] = useState<"REPLACE_AMOUNT" | "DEACTIVATE" | "REACTIVATE">("REPLACE_AMOUNT");
  const [revisionAmount, setRevisionAmount] = useState("");
  const [revisionReason, setRevisionReason] = useState("");
  const [cancelSource, setCancelSource] = useState<"INTERNAL_RECORD_ERROR" | "EXTERNAL_REPORTED">("INTERNAL_RECORD_ERROR");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelEvidence, setCancelEvidence] = useState("");
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const [replacementId, setReplacementId] = useState("");
  const [reviewReceiptId, setReviewReceiptId] = useState("");
  const [review, setReview] = useState<ReceiptReconciliation | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [reviewNet, setReviewNet] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [reviewEvidence, setReviewEvidence] = useState("");

  const load = useCallback(async () => {
    const [doc, links, receiptResponse, docList] = await Promise.all([
      getSupplierDocument(id),
      getDocumentAllocations(id),
      api.get<PurchaseReceiptListItem[]>("/purchase-receipts"),
      listSupplierDocuments(),
    ]);
    setDocument(doc);
    setAllocations(links);
    setReceipts(receiptResponse.data);
    setOtherDocuments(docList);
    setBasisAmount(doc.goodsNetAmount ?? "");
    setBasisCurrency(doc.currency ?? "MXN");
  }, [id]);

  useEffect(() => {
    if (session.status !== "success" || !allowed) return;
    let live = true;
    Promise.all([getSupplierDocument(id), getDocumentAllocations(id),
      api.get<PurchaseReceiptListItem[]>("/purchase-receipts"), listSupplierDocuments()])
      .then(([doc, links, receiptResponse, docList]) => {
        if (!live) return;
        setDocument(doc);
        setAllocations(links);
        setReceipts(receiptResponse.data);
        setOtherDocuments(docList);
        setBasisCurrency(doc.currency ?? "MXN");
        setBasisAmount(doc.goodsNetAmount ?? "");
        setLoading(false);
      }).catch((error: unknown) => {
        if (!live) return;
        if (isForbiddenError(error)) setForbidden(true);
        setLoadError(getApiErrorMessage(error, "No fue posible cargar el documento."));
        setLoading(false);
      });
    return () => { live = false; };
  }, [allowed, id, session.status]);

  const applicableReceipts = useMemo(() =>
    receipts.filter((item) => item.purchase.supplier.id === document?.supplierId),
  [document?.supplierId, receipts]);
  const otherInvoices = useMemo(() =>
    otherDocuments.filter((item) =>
      item.id !== id && item.supplierId === document?.supplierId &&
      item.type === "FACTURA" && item.status === "ACTIVE"),
  [document?.supplierId, id, otherDocuments]);
  const currentRevision = allocations.find((entry) => entry.id === revisionId);
  const active = document?.status === "ACTIVE";

  async function write(
    action: string,
    payload: unknown,
    call: (key: string) => Promise<unknown>,
  ) {
    if (saving) return false;
    const signature = JSON.stringify(payload);
    const previous = pending.current.get(action);
    const key = previous?.signature === signature ? previous.key : crypto.randomUUID();
    pending.current.set(action, { signature, key });
    setSaving(true);
    setActionError("");
    try {
      await call(key);
    } catch (error: unknown) {
      setActionError(getApiErrorMessage(error, "No se pudo completar la operación."));
      setSaving(false);
      return false;
    }
    // A successful mutation is never retried because the subsequent GET fails.
    pending.current.delete(action);
    try {
      await load();
      if (reviewReceiptId) {
        setReview(await getReceiptReconciliation(reviewReceiptId));
      }
    } catch (error: unknown) {
      setActionError(
        getApiErrorMessage(error, "Operación guardada, pero no fue posible actualizar los datos. Recarga esta página."),
      );
    } finally {
      setSaving(false);
    }
    return true;
  }

  async function showReview(targetId: string) {
    setReviewReceiptId(targetId);
    setReview(null);
    setReviewError("");
    try {
      setReview(await getReceiptReconciliation(targetId));
    } catch (error: unknown) {
      setReviewError(getApiErrorMessage(error, "No se pudo consultar la conciliación."));
    }
  }

  async function onConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document || !MONEY.test(basisAmount)) {
      setActionError("Indica una base neta con máximo dos decimales.");
      return;
    }
    const payload = {
      goodsNetAmount: basisAmount, currency: basisCurrency,
      reason: basisReason, expectedRevision: document.revision,
    };
    if (await write("confirm", payload, (key) =>
      confirmDocumentBasis(id, payload, key))) setBasisReason("");
  }


  async function onCorrectBasis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document || !MONEY.test(basisAmount) ||
        !/^[A-Z]{3}$/.test(basisCurrency) ||
        basisReason.trim().length < 10) {
      setActionError("Indica base neta, moneda ISO de tres letras y motivo de al menos 10 caracteres.");
      return;
    }
    const payload = {
      goodsNetAmount: basisAmount,
      currency: basisCurrency,
      reason: basisReason.trim(),
      expectedRevision: document.revision,
    };
    if (await write("correct-basis", payload, (key) =>
      correctSupplierDocumentBasis(id, payload, key))) {
      setBasisReason("");
    }
  }

  async function onAllocate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document || !receiptId || !MONEY.test(allocationAmount) ||
        Number(allocationAmount) <= 0) {
      setActionError("Selecciona una recepción e importe positivo válido.");
      return;
    }
    const payload = { receiptId, allocatedSubtotal: allocationAmount, expectedRevision: document.revision };
    if (await write("allocate", payload, (key) =>
      allocateSupplierInvoice(id, payload, key))) setAllocationAmount("");
  }

  async function onRevise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document || !currentRevision) return;
    if (revisionAction === "REPLACE_AMOUNT" &&
      (!MONEY.test(revisionAmount) || Number(revisionAmount) <= 0)) {
      setActionError("Indica un importe corregido positivo.");
      return;
    }
    const payload = {
      allocationId: currentRevision.id,
      action: revisionAction,
      ...(revisionAction === "REPLACE_AMOUNT" ? { allocatedSubtotal: revisionAmount } : {}),
      reason: revisionReason,
      expectedRevision: document.revision,
      expectedAllocationRevision: currentRevision.revision,
    };
    if (await write("revise", payload, (key) =>
      reviseSupplierAllocation(id, payload, key))) {
      setRevisionId("");
      setRevisionReason("");
      setRevisionAmount("");
    }
  }

  async function onCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document) return;
    if (!cancelConfirmed) {
      setActionError("Debes confirmar expresamente la cancelación documental.");
      return;
    }
    const payload = {
      source: cancelSource, reason: cancelReason,
      ...(cancelEvidence.trim() ? { evidenceReference: cancelEvidence.trim() } : {}),
      ...(replacementId ? { replacedByDocumentId: replacementId } : {}),
      expectedRevision: document.revision,
    };
    if (await write("cancel", payload, (key) =>
      cancelSupplierDocument(id, payload, key))) {
      setCancelReason("");
      setCancelConfirmed(false);
    }
  }

  async function onApprove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!review || !document || !MONEY.test(reviewNet) || !reviewReceiptId || !document.currency) {
      setActionError("Falta importe neto revisado o moneda confirmada.");
      return;
    }
    const payload = {
      receiptComparableNetAmount: reviewNet,
      receiptCurrency: document.currency,
      reason: reviewReason,
      evidenceReference: reviewEvidence,
      expectedSnapshotHash: review.snapshotHash,
    };
    if (await write("approval:" + reviewReceiptId, payload,
      (key) => approveReceiptVariance(reviewReceiptId, payload, key))) {
      setReviewReason("");
      setReviewEvidence("");
    }
  }

  if (session.status === "loading") return <PageContainer><Loading message="Verificando sesión..." /></PageContainer>;
  if (session.status === "success" && !allowed) return <PageContainer><ForbiddenState /></PageContainer>;
  if (session.status !== "success") return <PageContainer><p role="alert">Sesión no disponible.</p></PageContainer>;
  if (forbidden) return <PageContainer><ForbiddenState /></PageContainer>;
  if (loading) return <PageContainer><Loading message="Cargando documento..." /></PageContainer>;
  if (loadError || !document) {
    return <PageContainer><p role="alert">{loadError || "Documento no encontrado."}</p>
      <Link href="/supplier-documents">Volver al listado</Link></PageContainer>;
  }

  return (
    <PageContainer>
      <PageHeader title={"Documento " + [document.series, document.number].filter(Boolean).join("-")}
        description={documentTypeLabel(document.type) + " · " + documentDateLabel(document.documentDate)}
        action={<Link className="text-blue-700 underline" href="/supplier-documents">Volver a documentos</Link>} />
      <Section title="Información y estado">
        <dl className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-3">
          <div><dt className="text-text-muted">Serie</dt><dd>{document.series || "Sin serie"}</dd></div>
          <div><dt className="text-text-muted">Número de documento</dt><dd>{document.number}</dd></div>
          <div><dt className="text-text-muted">Estado</dt><dd className="font-semibold">{active ? "Activo" : "Cancelado"}</dd></div>
          <div><dt className="text-text-muted">{document.type === "FACTURA" ? "Base conciliable" : "Control documental"}</dt>
            <dd>{document.type === "FACTURA"
              ? document.basisStatus === "CONFIRMED" ? "Confirmada" : "Pendiente de revisión"
              : "Registrado · Sin conciliación monetaria"}</dd>
          </div>
          <div><dt className="text-text-muted">Moneda</dt><dd>{document.currency ?? "No informada"}</dd></div>
          <div><dt className="text-text-muted">Subtotal</dt><dd>{formatSupplierMoney(document.subtotalAmount, document.currency)}</dd></div>
          <div><dt className="text-text-muted">IVA</dt><dd>{formatSupplierMoney(document.ivaAmount, document.currency)}</dd></div>
          <div><dt className="text-text-muted">Total</dt><dd>{formatSupplierMoney(document.totalAmount, document.currency)}</dd></div>
          <div><dt className="text-text-muted">Neto de mercancía</dt><dd>{formatSupplierMoney(document.goodsNetAmount, document.currency)}</dd></div>
          <div><dt className="text-text-muted">UUID CFDI</dt><dd className="break-all">{document.cfdiUuid ?? "No disponible"}</dd></div>
          <div><dt className="text-text-muted">Revisión</dt><dd>{document.revision}</dd></div>
          {document.identityOccurrence > 1 && (
            <div><dt className="text-text-muted">Identidad comercial</dt>
              <dd>Excepción de folio #{document.identityOccurrence}</dd>
            </div>
          )}
        </dl>
        <p className="mt-3 text-sm text-text-muted">Documento recibido: Zaping no realiza timbrado ni verificación fiscal ante el SAT.</p>
      </Section>
      {actionError && <div role="alert" className="my-4 rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">{actionError}</div>}
      {active && document.type === "FACTURA" && document.basisStatus === "PENDING_REVIEW" && (
        <Section title="Confirmar base de mercancía">
          <form onSubmit={(event) => void onConfirm(event)} className="grid gap-3 md:grid-cols-3">
            <Input label="Base neta" required inputMode="decimal" value={basisAmount}
              onChange={(e) => setBasisAmount(e.target.value)} />
            <Input label="Moneda" required maxLength={3} value={basisCurrency}
              onChange={(e) => setBasisCurrency(e.target.value.toUpperCase())} />
            <Input label="Justificación" required minLength={10} value={basisReason}
              onChange={(e) => setBasisReason(e.target.value)} />
            <Button type="submit" disabled={saving}>Confirmar base revisada</Button>
          </form>
        </Section>
      )}
      {active && document.type === "FACTURA" && document.basisStatus === "CONFIRMED" && (
        <Section title="Corrección auditada de base confirmada">
          <p className="mb-3 text-sm text-text-muted">
            Una corrección menor que lo asignado requiere primero corregir los vínculos.
            No puedes cambiar la moneda si existen asignaciones activas.
          </p>
          <form onSubmit={(event) => void onCorrectBasis(event)} className="grid gap-3 md:grid-cols-3">
            <Input label="Base neta corregida" inputMode="decimal" required
              value={basisAmount} onChange={(event) => setBasisAmount(event.target.value)} />
            <Input label="Moneda corregida" maxLength={3} required
              value={basisCurrency} onChange={(event) => setBasisCurrency(event.target.value.toUpperCase())} />
            <Input label="Justificación de corrección" minLength={10} required
              value={basisReason} onChange={(event) => setBasisReason(event.target.value)} />
            <div className="md:col-span-3">
              <Button type="submit" disabled={saving}>Guardar corrección de base</Button>
            </div>
          </form>
        </Section>
      )}
      {active && document.type === "FACTURA" && document.basisStatus === "CONFIRMED" && (
        <Section title="Vincular factura a recepción">
          <p className="mb-3 text-sm text-text-muted">
            La asignación utiliza el neto de mercancía; no modifica stock. La cobertura de la recepción requiere revisión administrativa.
          </p>
          <form onSubmit={(event) => void onAllocate(event)} className="grid gap-3 md:grid-cols-3">
            <label className="text-sm font-medium">Recepción del mismo proveedor
              <select className={selectClass} value={receiptId} onChange={(e) => setReceiptId(e.target.value)} required>
                <option value="">Seleccionar recepción</option>
                {applicableReceipts.map((r) => <option key={r.id} value={r.id}>{r.folio} · OC {r.purchase.folio}</option>)}
              </select>
            </label>
            <Input label="Neto asignado a esta recepción" inputMode="decimal" required
              value={allocationAmount} onChange={(e) => setAllocationAmount(e.target.value)} />
            <div className="flex items-end"><Button type="submit" disabled={saving}>Vincular recepción</Button></div>
          </form>
        </Section>
      )}
      <Section title="Asignaciones y cobertura">
        {allocations.length === 0 ? (
          <p className="text-text-muted">Sin recepciones vinculadas.</p>
        ) : (
          <div className="space-y-3">
            {allocations.map((link) => (
              <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="text-sm">
                  <Link className="font-semibold text-blue-700 underline" href={"/purchase-receipts/" + encodeURIComponent(link.receiptId)}>
                    Recepción {link.receipt.folio}
                  </Link>
                  <p>{formatSupplierMoney(link.allocatedSubtotal, document.currency)} · {link.isActive ? "Activa" : "Inactiva"}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void showReview(link.receiptId)}>
                  Revisar cobertura
                </Button>
              </div>
            ))}
            {active && (
              <form onSubmit={(event) => void onRevise(event)} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-2">
                <label className="text-sm font-medium">Asignación que se va a corregir
                  <select className={selectClass} value={revisionId} onChange={(e) => {
                      setRevisionId(e.target.value);
                      const selected = allocations.find((link) => link.id === e.target.value);
                      setRevisionAction(selected?.isActive ? "REPLACE_AMOUNT" : "REACTIVATE");
                    }} required>
                    <option value="">Seleccionar vínculo</option>
                    {allocations.map((link) => <option key={link.id} value={link.id}>{link.receipt.folio} · {link.isActive ? "Activa" : "Inactiva"}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium">Acción
                  <select className={selectClass} value={revisionAction} onChange={(e) => setRevisionAction(e.target.value as typeof revisionAction)}>
                    <option value="REPLACE_AMOUNT" disabled={!currentRevision?.isActive}>Corregir importe</option>
                    <option value="DEACTIVATE" disabled={!currentRevision?.isActive}>Desactivar vínculo</option>
                    <option value="REACTIVATE" disabled={currentRevision?.isActive}>Reactivar vínculo</option>
                  </select>
                </label>
                {revisionAction === "REPLACE_AMOUNT" && <Input label="Nuevo importe" inputMode="decimal" required
                  value={revisionAmount} onChange={(e) => setRevisionAmount(e.target.value)} />}
                <Input label="Motivo del cambio" required minLength={10} value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)} helperText={inputReason} />
                <Button type="submit" disabled={saving || !currentRevision}>Guardar corrección auditada</Button>
              </form>
            )}
          </div>
        )}
        {reviewError && <p role="alert" className="text-red-700">{reviewError}</p>}
        {review && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <h3 className="font-semibold">Conciliación de la recepción</h3>
            <p>Asignado: {formatSupplierMoney(review.allocatedTotalAmount, document.currency)}</p>
            <p>Estado: {review.receiptReviewStatus === "APPROVED_VARIANCE" ? "Diferencia aprobada" : "Requiere revisión"}</p>
            <p className="text-sm">El costo histórico no establece un techo monetario verificado. No se declara cobertura automática completa.</p>
            {review.approvalCurrent && <p>Importe comparado: {formatSupplierMoney(review.receiptComparableNetAmount, review.receiptCurrency)}</p>}
            {active && document.type === "FACTURA" && !review.approvalCurrent && review.activeInvoiceCount > 0 && (
              <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => void onApprove(event)}>
                <Input label="Neto comparable de la recepción" inputMode="decimal" required
                  value={reviewNet} onChange={(e) => setReviewNet(e.target.value)} />
                <Input label="Evidencia de la revisión" required minLength={5}
                  value={reviewEvidence} onChange={(e) => setReviewEvidence(e.target.value)} />
                <Input label="Justificación de diferencia" required minLength={10}
                  value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} />
                <div className="flex items-end"><Button type="submit" disabled={saving}>Aprobar diferencia</Button></div>
              </form>
            )}
          </div>
        )}
      </Section>
      {active && document.type === "FACTURA" && (
        <Section title="Cancelar registro documental">
          <p className="mb-3 text-sm text-text-muted">Esta operación interna no cancela el CFDI ante el SAT. Desactiva la cobertura de este documento y conserva la auditoría.</p>
          <form onSubmit={(event) => void onCancel(event)} className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium">Origen de la cancelación
              <select className={selectClass} value={cancelSource} onChange={(e) => setCancelSource(e.target.value as typeof cancelSource)}>
                <option value="INTERNAL_RECORD_ERROR">Error de captura en Zaping</option>
                <option value="EXTERNAL_REPORTED">Cancelación reportada por proveedor</option>
              </select>
            </label>
            <label className="text-sm font-medium">Documento sustituto (opcional)
              <select className={selectClass} value={replacementId} onChange={(e) => setReplacementId(e.target.value)}>
                <option value="">Sin sustitución</option>
                {otherInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.series ?? ""} {invoice.number}</option>)}
              </select>
            </label>
            <Input label="Motivo de cancelación" required minLength={10} value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)} />
            <Input label="Referencia de evidencia" required={cancelSource === "EXTERNAL_REPORTED"}
              minLength={5} value={cancelEvidence} onChange={(e) => setCancelEvidence(e.target.value)} />
            <label className="md:col-span-2 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={cancelConfirmed}
                onChange={(event) => setCancelConfirmed(event.target.checked)} />
              Confirmo que cancelaré el registro documental en Zaping,
              sin tramitar la cancelación fiscal ante el SAT.
            </label>
            <div className="md:col-span-2">
              <Button type="submit" variant="danger" disabled={saving || !cancelConfirmed}>
                Cancelar registro documental
              </Button>
            </div>
          </form>
        </Section>
      )}
      <Section title="Historial de auditoría">
        {document.audits?.length ? (
          <ol className="space-y-2">
            {document.audits.map((event) => (
              <li key={event.id} className="rounded-lg border border-border p-3 text-sm">
                <strong>{event.operation}</strong> · Revisión {event.revisionAfter}
                <p className="text-text-muted">{event.createdAt.slice(0, 10)} · {event.reason ?? "Sin justificación adicional"}</p>
              </li>
            ))}
          </ol>
        ) : <p className="text-text-muted">No hay eventos disponibles.</p>}
      </Section>
    </PageContainer>
  );
}
