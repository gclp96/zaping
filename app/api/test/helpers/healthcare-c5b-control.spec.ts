import {
  c5bObservedContention,
  createC5bControl,
} from './healthcare-c5b-control';
import {
  c5bOperatorConnectionUrl,
  c5bValidateIdentity,
  withC5bHarness,
} from './healthcare-c5b-harness';
import { PrismaService } from '../../src/prisma/prisma.service';
import { HealthcareEquipmentAssignmentsRepository } from '../../src/healthcare/equipment-assignments/healthcare-equipment-assignments.repository';

describe('C5B explicit control session (pure)', () => {
  const url =
    'postgresql://operator:test-password@127.0.0.1:5434/zaping_spike_test';
  it('pins operator endpoint/pool/schema and never requires application lifecycle grants', () => {
    const parsed = new URL(c5bOperatorConnectionUrl(url));
    expect(parsed.hostname).toBe('127.0.0.1');
    expect(parsed.port).toBe('5434');
    expect(parsed.pathname).toBe('/zaping_spike_test');
    expect(parsed.searchParams.get('connection_limit')).toBe('1');
    expect(parsed.searchParams.get('schema')).toBe('public');
  });
  it.each([
    undefined,
    '',
    url.replace('127.0.0.1', 'localhost'),
    url.replace('5434', '5432'),
    url.replace('spike_test', 'qa'),
    url.replace('spike_test', 'dev'),
    url.replace('postgresql', 'https'),
    url.replace('operator:', 'zaping_hc_c5b:'),
    url.replace('test-password', ''),
    url + '?schema=other',
    url + '#override',
  ])(
    'rejects invalid operator target without printing credentials (%#)',
    (value) => {
      expect(() => c5bOperatorConnectionUrl(value)).toThrow(
        'C5B invalid operator URL',
      );
    },
  );
  it('accredits the operator identity independently of the application identity', () => {
    const row = {
      database: 'zaping_spike_test',
      user: 'operator',
      sessionUser: 'operator',
      schema: 'public',
      address: '172.17.0.2/32',
      port: 5432,
      version: '160015',
      pid: 33,
    };
    expect(c5bValidateIdentity([row], 'operator')).toEqual(row);
    expect(() => c5bValidateIdentity([row])).toThrow();
    expect(() =>
      c5bValidateIdentity([{ ...row, database: 'zaping_qa' }], 'operator'),
    ).toThrow();
    expect(() =>
      c5bValidateIdentity([{ ...row, sessionUser: 'other' }], 'operator'),
    ).toThrow();
  });
  it('disabled harness control mode is inert without either URL', async () => {
    const saved = process.env.RUN_HC_C5B_POSTGRES_TESTS;
    process.env.RUN_HC_C5B_POSTGRES_TESTS = '0';
    const operation = jest.fn();
    try {
      await withC5bHarness(operation, { control: true });
      expect(operation).not.toHaveBeenCalled();
    } finally {
      if (saved === undefined) delete process.env.RUN_HC_C5B_POSTGRES_TESTS;
      else process.env.RUN_HC_C5B_POSTGRES_TESTS = saved;
    }
  });
  const pids = [11, 22, 33] as const;
  const rows = () => [
    { pid: 11, username: 'zaping_hc_c5b', waiting: true, held: false },
    { pid: 22, username: 'zaping_hc_c5b', waiting: true, held: false },
    { pid: 33, username: 'operator', waiting: false, held: true },
  ];
  it('requires two real waiting application PIDs plus the held control lock', () => {
    expect(c5bObservedContention(rows(), pids)).toBe(true);
    const single = rows();
    single[1].waiting = false;
    expect(c5bObservedContention(single, pids)).toBe(false);
    const noBlocker = rows();
    noBlocker[2].held = false;
    expect(() => c5bObservedContention(noBlocker, pids)).toThrow();
  });
  it('rejects unknown/missing/duplicate PIDs and privileged command sessions', () => {
    expect(() =>
      c5bObservedContention([...rows(), { ...rows()[0], pid: 44 }], pids),
    ).toThrow();
    expect(() => c5bObservedContention(rows().slice(1), pids)).toThrow();
    expect(() => c5bObservedContention(rows(), [11, 11, 33])).toThrow();
    const privileged = rows();
    privileged[0].username = 'operator';
    expect(() => c5bObservedContention(privileged, pids)).toThrow();
  });
  it('failure to observe contention releases the rendezvous, drains requests and restores dispatch', async () => {
    const transaction = jest.fn(
      async (callback: (tx: unknown) => Promise<void>) =>
        callback({ $queryRaw: jest.fn().mockResolvedValue([]) }),
    );
    const operator = { $transaction: transaction } as unknown as PrismaService;
    const repository = new HealthcareEquipmentAssignmentsRepository(
      {} as PrismaService,
    );
    // Identity comparison only; the detached method is never invoked.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = repository.runCoverageNoteCommand;
    const owner = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'owned',
      rfc: 'owned',
      userId: 'actor',
    };
    const control = createC5bControl({
      concurrent: {} as PrismaService,
      operator,
      pids,
      owners: [owner],
      repository,
      checkBoundary: jest.fn().mockResolvedValue(undefined),
    });
    const request = jest.fn().mockResolvedValue('http');
    await expect(control.contend(owner.id, [request, request])).rejects.toThrow(
      'C5B control invariant failed',
    );
    expect(request).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.runCoverageNoteCommand).toBe(original);
    await expect(
      control.transition('foreign', 'case', 'requirement', 'cancel'),
    ).rejects.toThrow();
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it.each(['cancel', 'retire'] as const)(
    'transitions only an owned isolated fixture with complete %s audit',
    async (mode) => {
      const owner = {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'owned',
        rfc: 'owned',
        userId: 'actor',
      };
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        company: { count: jest.fn().mockResolvedValue(1) },
        user: { count: jest.fn().mockResolvedValue(1) },
        healthcareCase: {
          count: jest.fn().mockResolvedValue(1),
          update: jest.fn().mockResolvedValue({}),
        },
        healthcareCaseRequirement: {
          count: jest.fn().mockResolvedValue(1),
          update: jest.fn().mockResolvedValue({}),
        },
        healthcareEquipmentAssignment: {
          count: jest.fn().mockResolvedValue(0),
        },
      };
      const operator = {
        $transaction: jest.fn(
          async (callback: (value: typeof tx) => Promise<void>) => callback(tx),
        ),
      } as unknown as PrismaService;
      const control = createC5bControl({
        concurrent: {} as PrismaService,
        operator,
        pids,
        owners: [owner],
        repository: new HealthcareEquipmentAssignmentsRepository(
          {} as PrismaService,
        ),
        checkBoundary: jest.fn().mockResolvedValue(undefined),
      });
      await control.transition(owner.id, 'case', 'requirement', mode);
      if (mode === 'cancel') {
        expect(tx.healthcareCase.update).toHaveBeenCalledWith({
          where: { id: 'case' },
          data: {
            status: 'CANCELLED',
            cancelledAt: expect.any(Date) as Date,
            cancelledById: owner.userId,
            cancellationReason: 'C5B owned lifecycle replay fixture',
          },
        });
        expect(tx.healthcareCaseRequirement.update).not.toHaveBeenCalled();
      } else {
        expect(tx.healthcareCaseRequirement.update).toHaveBeenCalledWith({
          where: { id: 'requirement' },
          data: {
            lifecycle: 'RETIRED',
            retiredAt: expect.any(Date) as Date,
            retiredById: owner.userId,
            retirementReason: 'C5B owned lifecycle replay fixture',
          },
        });
        expect(tx.healthcareCase.update).not.toHaveBeenCalled();
      }
      tx.healthcareCase.update.mockClear();
      tx.healthcareCaseRequirement.update.mockClear();
      tx.healthcareCaseRequirement.count.mockResolvedValue(0);
      await expect(
        control.transition(owner.id, 'case', 'foreign-requirement', mode),
      ).rejects.toThrow();
      expect(tx.healthcareCase.update).not.toHaveBeenCalled();
      expect(tx.healthcareCaseRequirement.update).not.toHaveBeenCalled();
      tx.healthcareCaseRequirement.count.mockResolvedValue(1);
      tx.healthcareEquipmentAssignment.count.mockResolvedValue(1);
      await expect(
        control.transition(owner.id, 'case', 'requirement', mode),
      ).rejects.toThrow();
      expect(tx.healthcareCase.update).not.toHaveBeenCalled();
      expect(tx.healthcareCaseRequirement.update).not.toHaveBeenCalled();
    },
  );
});
