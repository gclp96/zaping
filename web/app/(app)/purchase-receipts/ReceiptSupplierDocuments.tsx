'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuthenticatedSession } from '@/app/auth-session';
import { hasRole, MANAGEMENT_ROLES } from '@/app/erp-role-access';
import Button from '@/app/components/ui/Button';
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
}: {
  receiptId: string;
  legacyReference: string | null;
}) {
  const session = useAuthenticatedSession();
  const role = session.status === 'success' ? session.user.role : null;
  const canView = hasRole(role, MANAGEMENT_ROLES);
  const [loaded, setLoaded] = useState<LoadedLinks | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

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
