import type { PurchaseReceiptFormItem } from '../types';
import { calculateReceiptQuantitySummary } from '../receipt-quantity-summary';

type ReceiptCaptureSummaryProps = {
  items: readonly PurchaseReceiptFormItem[];
};

const countFormatter = new Intl.NumberFormat('es-MX');

export default function ReceiptCaptureSummary({
  items,
}: ReceiptCaptureSummaryProps) {
  const summary = calculateReceiptQuantitySummary(items);
  const invalid = summary.status === 'invalid';

  return (
    <section
      data-testid="receipt-capture-summary"
      aria-labelledby="receipt-capture-summary-heading"
      className="min-w-0 rounded-xl border border-border bg-surface-subtle p-4 sm:p-5"
    >
      <h3
        id="receipt-capture-summary-heading"
        className="text-lg font-semibold text-text"
      >
        Resumen de esta recepción
      </h3>
      <p className="mt-1 text-sm text-text-muted">
        Vista previa de cantidades. La recepción y el inventario solo se
        actualizan cuando el servidor acepta el registro.
      </p>

      <dl className="mt-4 grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-sm text-text-secondary">Pendientes antes</dt>
          <dd data-testid="receipt-summary-pending-before" className="text-base font-semibold tabular-nums text-text">
            {summary.pendingBefore === null
              ? '—'
              : countFormatter.format(summary.pendingBefore)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-sm text-text-secondary">Recibir ahora</dt>
          <dd data-testid="receipt-summary-to-receive" className="text-lg font-bold tabular-nums text-text">
            {invalid ? '—' : countFormatter.format(summary.toReceive)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <dt className="text-sm font-medium text-text-secondary">
            Pendientes después
          </dt>
          <dd data-testid="receipt-summary-pending-after" className="text-lg font-bold tabular-nums text-text">
            {invalid ? '—' : countFormatter.format(summary.remainingAfter)}
          </dd>
        </div>
      </dl>

      {invalid ? (
        <p role="status" className="mt-4 text-sm font-medium text-danger">
          Revisa las cantidades ingresadas: no se calculan totales con
          valores inválidos.
        </p>
      ) : summary.status === 'empty' ? (
        <p role="status" className="mt-4 text-sm text-text-muted">
          Indica la cantidad a recibir de al menos una partida.
        </p>
      ) : (
        <p role="status" className="mt-4 text-sm text-text-muted">
          {summary.selectedLines} de {summary.totalLines} partidas con
          cantidades capturadas. El lote, la caducidad y los demás campos
          se validan al registrar.
        </p>
      )}
    </section>
  );
}
