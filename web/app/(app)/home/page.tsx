'use client';

import { useRouter } from 'next/navigation';
import {
  ClipboardPlus,
  FilePlus2,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react';

import Button from '@/app/components/ui/Button';
import { hasRole, COMMERCIAL_ROLES, WAREHOUSE_ROLES } from '@/app/erp-role-access';
import Card from '@/app/components/ui/Card';
import Loading from '@/app/components/ui/Loading';
import PageContainer from '@/app/components/ui/layout/PageContainer';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import Section from '@/app/components/ui/layout/Section';

import HomeAttentionSection from './HomeAttentionSection';
import { useHomeData } from './useHomeData';

type QuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  visibleForRoles: typeof COMMERCIAL_ROLES | typeof WAREHOUSE_ROLES;
};

const quickActions: QuickAction[] = [
  {
    label: 'Nueva cotización',
    href: '/quotes',
    icon: FilePlus2,
    visibleForRoles: COMMERCIAL_ROLES,
  },
  {
    label: 'Nueva venta',
    href: '/sales',
    icon: ShoppingCart,
    visibleForRoles: COMMERCIAL_ROLES,
  },
  {
    label: 'Nueva compra',
    href: '/purchases',
    icon: ClipboardPlus,
    visibleForRoles: WAREHOUSE_ROLES,
  },
  {
    label: 'Registrar recepción',
    href: '/purchases',
    icon: PackageCheck,
    visibleForRoles: WAREHOUSE_ROLES,
  },
];

const numberFormatter = new Intl.NumberFormat('es-MX');

function ResourceError({
  title,
  message,
  retryLabel,
  onRetry,
}: {
  title: string;
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-ui-md border border-danger/25 bg-danger-subtle p-4 text-danger sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-text-secondary">{message}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={onRetry}
      >
        <RefreshCw aria-hidden="true" size={16} />
        {retryLabel}
      </Button>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const {
    dashboardState,
    equipmentState,
    purchasesState,
    loadDashboard,
    loadEquipment,
    loadPurchases,
    initialLoading,
    attentionUpdating,
    attentionHasErrors,
    currentUserRole,
    sessionLoading,
  } = useHomeData();

  const visibleQuickActions = sessionLoading
    ? []
    : quickActions.filter((action) =>
        hasRole(currentUserRole, action.visibleForRoles),
      );

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Inicio"
        description="Resumen de tu operación diaria."
      />

      {visibleQuickActions.length > 0 ? (
        <Section title="Acciones rápidas">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {visibleQuickActions.map((action) => {
            const Icon = action.icon;

            return (
              <Button
                key={`${action.label}-${action.href}`}
                type="button"
                variant="outline"
                fullWidth
                className="min-h-12"
                onClick={() => router.push(action.href)}
              >
                <Icon aria-hidden="true" size={18} />
                {action.label}
              </Button>
            );
            })}
          </div>
        </Section>
      ) : null}

      {initialLoading ? (
        <Loading message="Cargando prioridades..." />
      ) : (
        <>
          {dashboardState.error ? (
            <ResourceError
              title="Inventario no disponible"
              message={dashboardState.error}
              retryLabel="Reintentar inventario"
              onRetry={() => void loadDashboard()}
            />
          ) : null}
          {equipmentState.error ? (
            <ResourceError
              title="Equipos no disponibles"
              message={equipmentState.error}
              retryLabel="Reintentar equipos"
              onRetry={() => void loadEquipment()}
            />
          ) : null}
          {purchasesState.error ? (
            <ResourceError
              title="Compras no disponibles"
              message={purchasesState.error}
              retryLabel="Reintentar compras"
              onRetry={() => void loadPurchases()}
            />
          ) : null}

          <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <HomeAttentionSection
              dashboardData={dashboardState.data}
              equipmentData={equipmentState.data}
              purchasesData={purchasesState.data}
              updating={attentionUpdating}
              hasErrors={attentionHasErrors}
            />

            <Section
              title="Resumen operativo"
              description="Referencias generales para continuar trabajando."
            >
              {dashboardState.data ? (
                <Card className="border border-border shadow-subtle">
                  <dl className="divide-y divide-border">
                    {[
                      ['Cotizaciones', dashboardState.data.totals.quotes],
                      ['Compras', dashboardState.data.totals.purchases],
                      ['Ventas', dashboardState.data.totals.sales],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <dt className="text-sm text-text-muted">{label}</dt>
                        <dd className="text-lg font-semibold text-text">
                          {numberFormatter.format(Number(value))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              ) : dashboardState.loading ? (
                <p className="text-sm text-text-muted" aria-live="polite">
                  Actualizando resumen...
                </p>
              ) : (
                <p className="text-sm text-text-muted">
                  El resumen estará disponible al recuperar inventario.
                </p>
              )}
            </Section>
          </div>
        </>
      )}
    </PageContainer>
  );
}
