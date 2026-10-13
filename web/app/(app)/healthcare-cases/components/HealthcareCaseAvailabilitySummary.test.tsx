import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getHealthcareCaseAvailability,
  type HealthcareCaseAvailability,
} from '@/services/healthcare-case-availability';
import { availabilityFixture } from '@/services/healthcare-case-availability.fixture';
import HealthcareCaseAvailabilitySummary from './HealthcareCaseAvailabilitySummary';

vi.mock('@/services/healthcare-case-availability', () => ({
  getHealthcareCaseAvailability: vi.fn(),
}));
const getAvailability = vi.mocked(getHealthcareCaseAvailability);

function deferred() {
  let resolve!: (value: HealthcareCaseAvailability) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<HealthcareCaseAvailability>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function show(data = availabilityFixture()) {
  getAvailability.mockResolvedValue(data);
  const view = render(
    <HealthcareCaseAvailabilitySummary caseId={data.caseId} />,
  );
  await screen.findByRole('heading', { name: 'Horario' });
  return view;
}

function dimension(name: string) {
  return within(screen.getByRole('region', { name }));
}

function expectValue(name: string, label: string, value: string) {
  expect(dimension(name).getByText(label).nextElementSibling?.textContent).toBe(
    value,
  );
}

describe('HealthcareCaseAvailabilitySummary', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(cleanup);

  it('announces loading while the scoped request is pending', () => {
    getAvailability.mockReturnValue(new Promise(() => {}));
    render(<HealthcareCaseAvailabilitySummary caseId="case-1" />);
    expect(screen.getByRole('status').textContent).toContain(
      'Cargando resumen',
    );
    expect(getAvailability).toHaveBeenCalledExactlyOnceWith('case-1');
  });

  it('renders five dimensions and a complete schedule with both dates', async () => {
    const data = availabilityFixture();
    await show(data);
    for (const name of [
      'Horario',
      'Requerimientos activos',
      'Cobertura de requerimientos',
      'Equipos reservados',
      'Preparación del maletín',
    ]) {
      expect(screen.getByRole('heading', { name, level: 3 })).toBeTruthy();
    }
    expect(dimension('Horario').getByText('Horario completo')).toBeTruthy();
    for (const [label, date] of [
      ['Inicio', data.schedule.scheduledStart],
      ['Fin', data.schedule.scheduledEnd],
    ]) {
      expectValue(
        'Horario',
        label!,
        new Date(date!).toLocaleString('es-MX', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
      );
    }
  });

  it('presents incomplete schedule and its warning without inferring from dates', async () => {
    const data = availabilityFixture();
    data.schedule.complete = false;
    data.schedule.scheduledEnd = null;
    data.schedule.warnings = [
      {
        code: 'INCOMPLETE_CASE_SCHEDULE',
        message: 'Revisar el horario del caso',
      },
    ];
    await show(data);
    expectValue('Horario', 'Fin', 'Sin registrar');
    expect(dimension('Horario').getByText('Horario incompleto')).toBeTruthy();
    expect(
      dimension('Horario').getByText('Revisar el horario del caso'),
    ).toBeTruthy();
  });

  it('shows explicit neutral absence of active requirements', async () => {
    const data = availabilityFixture();
    data.requirements = { activeCount: 0, requiredCount: 0, backupCount: 0 };
    await show(data);
    expect(
      dimension('Requerimientos activos').getByText(
        'Sin requerimientos activos registrados',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(/No requiere equipo|No aplica|No requerido/),
    ).toBeNull();
  });

  it('renders backend requirement counts, all coverage counts and active notes', async () => {
    await show();
    for (const [label, value] of [
      ['Total activos', '10'],
      ['Obligatorios', '7'],
      ['Respaldo', '3'],
    ])
      expectValue('Requerimientos activos', label, value);
    for (const [label, value] of [
      ['Requerimientos evaluados', '10'],
      ['Cubiertos', '4'],
      ['Parciales', '3'],
      ['Pendientes', '2'],
      ['No disponibles', '1'],
      ['Notas de cobertura activas', '5'],
    ])
      expectValue('Cobertura de requerimientos', label, value);
  });

  it.each([true, false, null])(
    'presents authoritative equipment conflictFree=%s without deriving from counts',
    async (conflictFree) => {
      const data = availabilityFixture();
      data.equipment = {
        reservedAssignmentCount: 0,
        fullyVerifiable: false,
        conflictFree,
        warnings: [
          {
            code: 'CURRENT_ASSIGNMENT_CONFLICT',
            message: 'Revisar conflicto de equipo',
          },
        ],
      };
      await show(data);
      expectValue('Equipos reservados', 'Asignaciones reservadas', '0');
      expectValue('Equipos reservados', 'Verificación completa', 'No');
      expectValue(
        'Equipos reservados',
        'Sin conflictos',
        conflictFree === null ? 'Sin determinar' : conflictFree ? 'Sí' : 'No',
      );
      expect(
        dimension('Equipos reservados').getByText(
          'Revisar conflicto de equipo',
        ),
      ).toBeTruthy();
      expect(
        screen
          .getByRole('link', { name: 'Ver asignaciones' })
          .getAttribute('href'),
      ).toBe('/healthcare-cases/case-1/equipment-assignments');
    },
  );

  it('shows fully verifiable equipment as returned', async () => {
    await show();
    expectValue('Equipos reservados', 'Verificación completa', 'Sí');
    expectValue('Equipos reservados', 'Asignaciones reservadas', '6');
  });

  it.each(['DRAFT', 'PREPARED'] as const)(
    'shows a present %s kit with PASS scoped to preparation',
    async (status) => {
      const data = availabilityFixture();
      data.preparation.status = status;
      await show(data);
      const kit = dimension('Preparación del maletín');
      expect(kit.getByText('Maletín registrado')).toBeTruthy();
      expect(
        kit.getByText(status === 'DRAFT' ? 'Borrador' : 'Preparado'),
      ).toBeTruthy();
      expect(kit.getByText('Listo para confirmar')).toBeTruthy();
      expect(screen.getAllByText('Listo para confirmar')).toHaveLength(1);
      expect(
        kit.getByRole('link', { name: 'Ver maletín' }).getAttribute('href'),
      ).toBe('/healthcare-cases/case-1/case-kit');
      expect(
        screen.queryByText(
          /^(AVAILABLE|UNAVAILABLE|READY|NOT READY|Disponible|Listo)$/,
        ),
      ).toBeNull();
    },
  );

  it('keeps BLOCKED and blockers within preparation even with covered requirements', async () => {
    const data = availabilityFixture();
    data.preparation.readiness = {
      status: 'BLOCKED',
      blockers: [
        { code: 'CASE_KIT_REQUIRED_ASSET_NOT_COVERED', requirementId: 'req-1' },
      ],
    };
    await show(data);
    const kit = dimension('Preparación del maletín');
    expect(kit.getByText('Bloqueado')).toBeTruthy();
    expect(
      kit.getByText(
        'Faltan equipos reservados para un requerimiento obligatorio.',
      ),
    ).toBeTruthy();
    expect(screen.getAllByText('Bloqueado')).toHaveLength(1);
    expectValue('Cobertura de requerimientos', 'Cubiertos', '4');
  });

  it('shows neutral absence of CaseKit and still offers its drill-down', async () => {
    const data = availabilityFixture();
    data.preparation = { caseKitId: null, status: null, readiness: null };
    await show(data);
    expect(
      dimension('Preparación del maletín').getByText('Sin maletín registrado'),
    ).toBeTruthy();
    expect(
      screen.queryByText(/Listo|Bloqueado|No requerido|No aplica/),
    ).toBeNull();
    expect(screen.getByRole('link', { name: 'Ver maletín' })).toBeTruthy();
  });

  it.each([401, 403, 404, 500])(
    'handles %s within the summary and allows retry',
    async (status) => {
      getAvailability
        .mockRejectedValueOnce({ isAxiosError: true, response: { status } })
        .mockResolvedValue(availabilityFixture());
      render(<HealthcareCaseAvailabilitySummary caseId="case-1" />);
      if (status === 403)
        await screen.findByRole('heading', { name: 'Sin permisos' });
      else {
        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toContain(
          status === 404
            ? 'No se encontró el caso'
            : status === 401
              ? 'autenticación'
              : 'No fue posible cargar',
        );
      }
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'Reintentar resumen' }));
      await screen.findByText('Horario completo');
      expect(getAvailability).toHaveBeenCalledTimes(2);
    },
  );

  it('discards Case A response after switching to B and clears previously rendered data', async () => {
    const a = deferred();
    const b = deferred();
    getAvailability
      .mockReturnValueOnce(a.promise)
      .mockReturnValueOnce(b.promise);
    const view = render(<HealthcareCaseAvailabilitySummary caseId="case-a" />);
    view.rerender(<HealthcareCaseAvailabilitySummary caseId="case-b" />);
    await act(async () => a.resolve(availabilityFixture('case-a')));
    expect(screen.queryByText('Horario completo')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
    const dataB = availabilityFixture('case-b');
    dataB.equipment.reservedAssignmentCount = 99;
    await act(async () => b.resolve(dataB));
    expectValue('Equipos reservados', 'Asignaciones reservadas', '99');
    expect(
      screen
        .getByRole('link', { name: 'Ver asignaciones' })
        .getAttribute('href'),
    ).toContain('case-b');
    getAvailability.mockReturnValue(new Promise(() => {}));
    view.rerender(<HealthcareCaseAvailabilitySummary caseId="case-c" />);
    expect(screen.queryByText('99')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('clears the previous successful summary on refresh, including when refresh fails', async () => {
    await show();
    const pending = deferred();
    getAvailability.mockReturnValueOnce(pending.promise);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Actualizar resumen' }));
    expect(screen.queryByText('Horario completo')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
    await act(async () => pending.reject(new Error('Fallo temporal')));
    expect(screen.getByRole('alert').textContent).toBe('Fallo temporal');
    expect(screen.queryByText('Horario completo')).toBeNull();
  });
});
