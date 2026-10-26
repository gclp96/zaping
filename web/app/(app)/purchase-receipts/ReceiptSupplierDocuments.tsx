'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuthenticatedSession } from '@/app/auth-session';
import { hasRole, MANAGEMENT_ROLES } from '@/app/erp-role-access';
import Button from '@/app/components/ui/Button';
import Select from '@/app/components/ui/Select';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/services/errors';

type LinkedSupplierDocument = {
  id: string;
  receiptId: string;
  documentId: string;
  document: {
    id: string;
    type: 'FACTURA' | 'REMISION' | 'NOTA_ENTREGA';
    series: string | null;
    number: string;
    status: 'ACTIVE' | 'CANCELLED';
  };
};

type AvailableSupplierDocument = LinkedSupplierDocument['document'] & {
  supplierId: string;
  identityOccurrence: number;
};

type LoadedLinks = {
  receiptId: string;
  links: LinkedSupplierDocument[];
};

function documentLabel(document: LinkedSupplierDocument['document']) {
  const number = [document.series, document.number].filter(Boolean).join('-');
  return `${document.type.replaceAll('_', ' ')} · ${number}`;
}

export default function ReceiptSupplierDocuments({
  receiptId,
  legacyReference,
  supplierId,
}: {
  receiptId: string;
  legacyReference: string | null;
  supplierId: string;
}) {
  const session = useAuthenticatedSession();
  const role = session.status === 'success' ? session.user.role : null;
  const canView = hasRole(role, MANAGEMENT_ROLES);
  const [loaded, setLoaded] = useState<LoadedLinks | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [picker, setPicker] = useState<{
    supplierId: string;
    documents: AvailableSupplierDocument[];
  } | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [selection, setSelection] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!canView) return;
    let current = true;

    api
      .get<LinkedSupplierDocument[]>(
        `/supplier-documents/receipts/${encodeURIComponent(receiptId)}/links`,
      )
      .then(({ data }) => {
        if (!current) return;
        if (
          !Array.isArray(data) ||
          data.some(
            (link) =>
              !link.document ||
              link.receiptId !== receiptId ||
              link.documentId !== link.document.id ||
              !link.document.id ||
              !link.document.number,
          )
        ) {
          setError('La respuesta de vínculos documentales no es válida.');
          return;
        }
        setLoaded({ receiptId, links: data });
        setError('');
      })
      .catch((requestError: unknown) => {
        if (!current) return;
        setError(
          getApiErrorMessage(
            requestError,
            'No fue posible consultar los documentos vinculados.',
          ),
        );
      });

    return () => {
      current = false;
    };
  }, [canView, receiptId, reload]);

  const links = loaded?.receiptId === receiptId ? loaded.links : null;

  const available = picker?.supplierId === supplierId
    ? picker.documents.filter(
        (doc) =>
          doc.status === 'ACTIVE' &&
          !links?.some((link) => link.documentId === doc.id),
      )
    : null;

  async function openPicker() {
    if (!canView || pickerLoading || saving) return;
    setPickerLoading(true);
    setActionError('');
    setPicker(null);
    setSelection('');
    try {
      const response = await api.get<AvailableSupplierDocument[]>(
        '/supplier-documents',
        { params: { supplierId } },
      );
      if (
        !Array.isArray(response.data) ||
        response.data.some(
          (doc) =>
            !doc.id ||
            doc.supplierId !== supplierId ||
            !doc.number ||
            !['ACTIVE', 'CANCELLED'].includes(doc.status),
        )
      ) {
        throw new Error('Respuesta de documentos del proveedor inválida.');
      }
      setPicker({ supplierId, documents: response.data });
    } catch (requestError: unknown) {
      setActionError(
        getApiErrorMessage(
          requestError,
          'No fue posible cargar los documentos del proveedor.',
        ),
      );
    } finally {
      setPickerLoading(false);
    }
  }

  async function attachDocument() {
    if (!canView || saving || !selection || !available) return;
    const selected = available.find((doc) => doc.id === selection);
    if (!selected) {
      setActionError('El documento seleccionado ya no está disponible.');
      return;
    }
    setSaving(true);
    setActionError('');
    try {
      await api.post(
        `/supplier-documents/receipts/${encodeURIComponent(receiptId)}/links`,
        { documentId: selected.id },
      );
      setPicker(null);
      setSelection('');
      setLoaded(null);
      setReload((value) => value + 1);
    } catch (requestError: unknown) {
      setActionError(
        getApiErrorMessage(
          requestError,
          'No fue posible vincular el documento seleccionado.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }



  return (
    <div className="space-y-2 text-sm font-normal">
      {legacyReference && (
        <p className="text-text-secondary">
          Referencia registrada: {legacyReference}
        </p>
      )}

      {session.status === 'loading' && (
        <p className="text-text-muted">Verificando permisos documentales...</p>
      )}

      {session.status === 'success' && !canView && (
        <p className="text-text-muted">
          Solo Administración o Gerencia puede consultar los documentos vinculados.
        </p>
      )}

      {(session.status === 'error' || session.status === 'unauthenticated') && (
        <p className="text-text-muted">
          No fue posible verificar permisos para los documentos.
        </p>
      )}

      {canView && error && (
        <div role="alert" className="space-y-2">
          <p className="text-red-700">{error}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setError('');
              setLoaded(null);
              setReload((value) => value + 1);
            }}
          >
            Reintentar documentos
          </Button>
        </div>
      )}

      {canView && !error && links === null && (
        <p className="text-text-muted">Cargando documentos vinculados...</p>
      )}

      {canView && !error && links?.length === 0 && (
        <p className="text-text-muted">
          {legacyReference
            ? 'Referencia documental sin vínculo por ID. No se puede abrir por folio.'
            : 'Sin documento vinculado por ID.'}
        </p>
      )}

      {canView && !error && links !== null && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {!picker && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={pickerLoading}
              onClick={() => void openPicker()}
            >
              Vincular documento existente
            </Button>
          )}

          {picker?.supplierId === supplierId && (
            <div className="space-y-2">
              <p className="text-text-muted">
                Solo documentos activos del proveedor de esta compra.
                Se muestran hasta 50 documentos recientes; el vínculo
                no modifica la conciliación monetaria.
              </p>
              {available?.length === 0 ? (
                <p className="text-text-muted">
                  No hay documentos recientes disponibles para vincular.
                </p>
              ) : (
                <Select
                  label="Documento del proveedor"
                  value={selection}
                  onChange={(event) => setSelection(event.target.value)}
                  options={(available ?? []).map((doc) => ({
                    value: doc.id,
                    label: `${documentLabel(doc)} · Ocurrencia #${doc.identityOccurrence}`,
                  }))}
                  placeholder="Selecciona el documento exacto"
                  disabled={saving}
                />
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  loading={saving}
                  disabled={!selection || !(available ?? []).some((doc) => doc.id === selection)}
                  onClick={() => void attachDocument()}
                >
                  Confirmar vínculo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    setPicker(null);
                    setSelection('');
                    setActionError('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
          {actionError && <p role="alert" className="text-red-700">{actionError}</p>}
        </div>
      )}

      {canView && !error && links && links.length > 0 && (
        <ul className="space-y-2" aria-label="Documentos vinculados a esta recepción">
          {links.map((link) => (
            <li key={link.id} className="flex flex-wrap items-center gap-2">
              <span className="text-text-secondary">
                {documentLabel(link.document)}
                {link.document.status === 'CANCELLED' && ' (registro cancelado)'}
              </span>
              <Link
                href={`/supplier-documents/${encodeURIComponent(link.document.id)}`}
                aria-label={`Ver documento ${documentLabel(link.document)}`}
                className="font-semibold text-blue-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
              >
                Ver documento
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
