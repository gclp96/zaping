import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/services/api';

import HealthcareDoctorSelector from './HealthcareDoctorSelector';

vi.mock('@/services/api', () => ({
  api: { get: vi.fn() },
}));

const activeDoctor = {
  id: 'doctor-active',
  firstName: 'Ana',
  lastName: 'Torres',
  specialty: 'Cardiología',
  isActive: true,
};

const inactiveDoctor = {
  id: 'doctor-inactive',
  firstName: 'Bruno',
  lastName: 'López',
  specialty: 'Traumatología',
  isActive: false,
};

async function finishDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
}

describe('HealthcareMasterSelector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('busca sólo activos, excluye inactivos y permite limpiar la selección', async () => {
    const onChange = vi.fn();
    vi.mocked(api.get).mockResolvedValue({
      data: { items: [activeDoctor, inactiveDoctor] },
    } as never);

    render(
      <HealthcareDoctorSelector
        value={activeDoctor.id}
        currentValue={activeDoctor}
        sessionKey="user-1:company-1"
        onChange={onChange}
      />,
    );
    await finishDebounce();

    expect(api.get).toHaveBeenCalledWith('/healthcare/doctors', {
      params: { page: 1, pageSize: 100, status: 'ACTIVE' },
    });
    const selector = screen.getByRole('combobox', { name: 'Médico' });
    expect(
      screen.getByRole('option', { name: 'Ana Torres — Cardiología' }),
    ).toBeTruthy();
    expect(screen.queryByText(/Bruno López/)).toBeNull();

    fireEvent.change(selector, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null, null);
  });

  it('conserva visible una relación histórica inactiva sin ofrecerla como opción nueva', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [] } } as never);

    render(
      <HealthcareDoctorSelector
        value={inactiveDoctor.id}
        currentValue={inactiveDoctor}
        sessionKey="user-1:company-1"
        onChange={vi.fn()}
      />,
    );
    await finishDebounce();

    const historicalOption = screen.getByRole('option', {
      name: 'Bruno López — Traumatología — Inactivo (histórico)',
    });
    expect(historicalOption).toHaveProperty('disabled', true);
    expect(screen.getByText(/relación histórica permanece visible/)).toBeTruthy();
  });

  it('muestra error y permite reintentar la carga', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('Catálogo no disponible'))
      .mockResolvedValueOnce({ data: { items: [activeDoctor] } } as never);
    render(
      <HealthcareDoctorSelector
        value={null}
        sessionKey="user-1:company-1"
        onChange={vi.fn()}
      />,
    );
    await finishDebounce();

    expect(screen.getByText('Catálogo no disponible')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await finishDebounce();

    expect(api.get).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole('option', { name: 'Ana Torres — Cardiología' }),
    ).toBeTruthy();
  });
});
