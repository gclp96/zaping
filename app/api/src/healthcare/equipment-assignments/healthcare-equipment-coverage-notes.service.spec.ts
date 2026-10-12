import {
  HealthcareEquipmentRequirementCoverageNoteKind,
  Prisma,
} from '@prisma/client';
import { HealthcareEquipmentCoverageNotesService } from './healthcare-equipment-coverage-notes.service';
import { HealthcareEquipmentAssignmentsRepository } from './healthcare-equipment-assignments.repository';
import { HealthcareCompanyTransactionTimeoutPolicy } from '../common/healthcare-company-transaction-timeout-policy';

describe('CoverageNote commands / DEC-C5-COV-06 (transaction model, no database)', () => {
  type Note = {
    id: string;
    requirementId: string;
    kind: HealthcareEquipmentRequirementCoverageNoteKind;
    comment: string;
    createdAt: Date;
    recordedBy: { id: string };
    resolvedAt: Date | null;
    resolvedBy: { id: string } | null;
  };
  type Claim = { id: string; requestHash: string; resourceId: string | null };
  let notes: Note[];
  let claims: Map<string, Claim>;
  const tx = {} as Prisma.TransactionClient;
  const repository = {
    runCoverageNoteCommand: jest.fn(),
    lockCoverageCase: jest.fn(),
    lockRequirement: jest.fn(),
    lockCoverageNote: jest.fn(),
    findCase: jest.fn(),
    findRequirement: jest.fn(),
    findIdempotencyRecord: jest.fn(),
    findCoverageAssignments: jest.fn(),
    findActiveCoverageNote: jest.fn(),
    findCoverageNote: jest.fn(),
    createIdempotencyClaim: jest.fn(),
    completeIdempotencyClaim: jest.fn(),
    createCoverageNote: jest.fn(),
    resolveCoverageNote: jest.fn(),
  };
  const service = new HealthcareEquipmentCoverageNotesService(
    repository as unknown as HealthcareEquipmentAssignmentsRepository,
    {} as HealthcareCompanyTransactionTimeoutPolicy,
  );
  const create = (
    kind: HealthcareEquipmentRequirementCoverageNoteKind = 'UNAVAILABLE',
    key = 'create',
    comment = ' Context ',
    actor = 'actor',
  ) =>
    service.create('company', actor, 'case', 'requirement', key, {
      kind,
      comment,
    });
  const resolve = (id: string, key = 'resolve', actor = 'resolver') =>
    service.resolve('company', actor, 'case', 'requirement', id, key);
  const requirement = (lifecycle = 'ACTIVE', caseId = 'case') => ({
    id: 'requirement',
    caseId,
    productId: 'product',
    requestedQty: 2,
    lifecycle,
    product: { inventoryTracking: 'ASSET' },
  });
  const assignment = (productId = 'product', condition = 'GOOD') => ({
    requirementId: 'requirement',
    equipmentAsset: { productId, lifecycle: 'ACTIVE', condition },
  });

  beforeEach(() => {
    jest.resetAllMocks();
    notes = [];
    claims = new Map();
    repository.runCoverageNoteCommand.mockImplementation(
      async (
        _company: string,
        _policy: unknown,
        action: (client: Prisma.TransactionClient) => Promise<unknown>,
      ) => {
        const before = structuredClone({ notes, claims });
        try {
          return await action(tx);
        } catch (error) {
          notes = before.notes;
          claims = before.claims;
          throw error;
        }
      },
    );
    repository.lockCoverageCase.mockResolvedValue(true);
    repository.lockRequirement.mockResolvedValue(true);
    repository.lockCoverageNote.mockImplementation(
      (_tx: unknown, _company: string, req: string, id: string) =>
        Promise.resolve(
          notes.some((n) => n.id === id && n.requirementId === req),
        ),
    );
    repository.findCase.mockResolvedValue({ id: 'case', status: 'SCHEDULED' });
    repository.findRequirement.mockResolvedValue(requirement());
    repository.findCoverageAssignments.mockResolvedValue([]);
    repository.findIdempotencyRecord.mockImplementation(
      (company: string, key: string, scope: string) =>
        Promise.resolve(claims.get(`${company}:${scope}:${key}`) ?? null),
    );
    repository.createIdempotencyClaim.mockImplementation(
      (
        _tx: unknown,
        company: string,
        key: string,
        scope: string,
        hash: string,
      ) => {
        const id = `${company}:${scope}:${key}`;
        const claim = { id, requestHash: hash, resourceId: null };
        claims.set(id, claim);
        return Promise.resolve(claim);
      },
    );
    repository.completeIdempotencyClaim.mockImplementation(
      (_tx: unknown, id: string, resourceId: string) => {
        claims.get(id)!.resourceId = resourceId;
        return Promise.resolve({ id });
      },
    );
    repository.findCoverageNote.mockImplementation(
      (_tx: unknown, _company: string, req: string, id: string) =>
        Promise.resolve(
          structuredClone(
            notes.find((n) => n.id === id && n.requirementId === req) ?? null,
          ),
        ),
    );
    repository.findActiveCoverageNote.mockImplementation(
      (_tx: unknown, _company: string, req: string, kind: string) =>
        Promise.resolve(
          notes.find(
            (n) => n.requirementId === req && n.kind === kind && !n.resolvedAt,
          ) ?? null,
        ),
    );
    repository.createCoverageNote.mockImplementation(
      (
        _tx: unknown,
        data: {
          requirementId: string;
          kind: HealthcareEquipmentRequirementCoverageNoteKind;
          comment: string;
          recordedById: string;
        },
      ) => {
        const note: Note = {
          id: `note-${notes.length}`,
          requirementId: data.requirementId,
          kind: data.kind,
          comment: data.comment,
          createdAt: new Date(0),
          recordedBy: { id: data.recordedById },
          resolvedAt: null,
          resolvedBy: null,
        };
        notes.push(note);
        return Promise.resolve(structuredClone(note));
      },
    );
    repository.resolveCoverageNote.mockImplementation(
      (
        _tx: unknown,
        _company: string,
        _req: string,
        id: string,
        actor: string,
      ) => {
        const note = notes.find((n) => n.id === id)!;
        note.resolvedAt = new Date(1000);
        note.resolvedBy = { id: actor };
        return Promise.resolve({ count: 1 });
      },
    );
  });

  function expectZeroWrite() {
    expect(repository.createCoverageNote).not.toHaveBeenCalled();
    expect(repository.resolveCoverageNote).not.toHaveBeenCalled();
    expect(repository.createIdempotencyClaim).not.toHaveBeenCalled();
    expect(claims.size).toBe(0);
    expect(notes).toEqual([]);
  }
  it('creates UNAVAILABLE at zero with normalized comment and server actor, without private fields', async () => {
    const result = await create();
    expect(result).toMatchObject({
      kind: 'UNAVAILABLE',
      comment: 'Context',
      recordedBy: { id: 'actor' },
    });
    expect(result).not.toHaveProperty('companyId');
    expect(result).not.toHaveProperty('recordedById');
    expect([...claims.values()][0].resourceId).toBe(result.id);
  });
  it('does not invent a comment length limit', async () => {
    expect(
      (await create('UNAVAILABLE', 'long', 'x'.repeat(4000))).comment,
    ).toHaveLength(4000);
  });
  it.each(['', ' ', '\n\t'])(
    'rejects blank comment %j before transactions',
    async (comment) => {
      await expect(
        Promise.resolve().then(() => create('UNAVAILABLE', 'key', comment)),
      ).rejects.toMatchObject({ status: 400 });
      expectZeroWrite();
      expect(repository.runCoverageNoteCommand).not.toHaveBeenCalled();
    },
  );
  it.each([undefined, '', ' ', 'x'.repeat(129)])(
    'requires a valid key %j',
    async (key) => {
      await expect(
        Promise.resolve().then(() =>
          service.create('company', 'actor', 'case', 'requirement', key, {
            kind: 'UNAVAILABLE',
            comment: 'OK',
          }),
        ),
      ).rejects.toMatchObject({ status: 400 });
      expectZeroWrite();
    },
  );
  it.each([
    ['UNAVAILABLE', 1, false],
    ['UNAVAILABLE', 2, false],
    ['PARTIAL_CONTEXT', 0, false],
    ['PARTIAL_CONTEXT', 1, true],
    ['PARTIAL_CONTEXT', 2, false],
    ['PARTIAL_CONTEXT', 3, false],
  ] as const)(
    '%s at effective count %s: valid=%s',
    async (kind, count, valid) => {
      repository.findCoverageAssignments.mockResolvedValue(
        Array.from({ length: count }, () => assignment()),
      );
      if (valid) expect((await create(kind)).kind).toBe(kind);
      else {
        await expect(create(kind)).rejects.toMatchObject({ status: 409 });
        expectZeroWrite();
      }
    },
  );
  it('uses R effective eligibility, excluding incompatible and damaged nominal assignments', async () => {
    repository.findCoverageAssignments.mockResolvedValue([
      assignment('wrong'),
      assignment('product', 'DAMAGED'),
    ]);
    await create();
    expect(repository.findCoverageAssignments).toHaveBeenCalledWith(
      'company',
      'case',
      ['requirement'],
      tx,
    );
  });
  it('rejects duplicate same-kind without a loser claim', async () => {
    await create();
    await expect(create('UNAVAILABLE', 'other')).rejects.toMatchObject({
      status: 409,
    });
    expect(notes).toHaveLength(1);
    expect(claims.size).toBe(1);
  });
  it('models Company serialization for different-key duplicate requests: one note and one 409', async () => {
    const transaction =
      repository.runCoverageNoteCommand.getMockImplementation() as (
        ...args: unknown[]
      ) => Promise<unknown>;
    let tail: Promise<unknown> = Promise.resolve();
    repository.runCoverageNoteCommand.mockImplementation(
      (...args: unknown[]) => {
        const result = tail.then(() => transaction(...args));
        tail = result.catch(() => undefined);
        return result;
      },
    );
    const results = await Promise.allSettled([
      create('UNAVAILABLE', 'parallel-a'),
      create('UNAVAILABLE', 'parallel-b'),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === 'rejected'),
    ).toMatchObject({ reason: { status: 409 } });
    expect(notes).toHaveLength(1);
    expect(claims.size).toBe(1);
  });
  it('preserves stale opposite kind when creating a currently valid kind', async () => {
    const old = await create();
    repository.findCoverageAssignments.mockResolvedValue([assignment()]);
    await create('PARTIAL_CONTEXT', 'partial');
    expect(notes[0]).toEqual(old);
    expect(notes).toHaveLength(2);
  });
  it('replays normalized create without a second write, actor excluded from hash', async () => {
    const original = await create();
    expect(
      await create('UNAVAILABLE', 'create', 'Context', 'other-actor'),
    ).toEqual(original);
    expect(repository.createCoverageNote).toHaveBeenCalledTimes(1);
    expect(claims.size).toBe(1);
  });
  it('rejects different normalized create command on same key', async () => {
    await create();
    await expect(
      create('UNAVAILABLE', 'create', 'Different'),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'IDEMPOTENCY_KEY_REUSED' },
    });
  });
  it.each(['CANCELLED', 'RETIRED'])(
    'rejects new create on %s with zero writes',
    async (status) => {
      if (status === 'CANCELLED')
        repository.findCase.mockResolvedValue({ status });
      else repository.findRequirement.mockResolvedValue(requirement(status));
      await expect(create()).rejects.toMatchObject({ status: 409 });
      expectZeroWrite();
    },
  );
  it.each(['CANCELLED', 'RETIRED'])(
    'completed create replay survives later %s; new key fails',
    async (status) => {
      const original = await create();
      if (status === 'CANCELLED')
        repository.findCase.mockResolvedValue({ status });
      else repository.findRequirement.mockResolvedValue(requirement(status));
      expect(await create()).toEqual(original);
      await expect(create('UNAVAILABLE', 'new')).rejects.toMatchObject({
        status: 409,
      });
      expect(notes).toHaveLength(1);
      expect(claims.size).toBe(1);
    },
  );
  it.each(['CANCELLED', 'RETIRED'])(
    'resolve remains allowed after %s',
    async (status) => {
      const original = await create();
      if (status === 'CANCELLED')
        repository.findCase.mockResolvedValue({ status });
      else repository.findRequirement.mockResolvedValue(requirement(status));
      const resolved = await resolve(original.id);
      expect(resolved).toMatchObject({
        ...original,
        resolvedAt: new Date(1000),
        resolvedBy: { id: 'resolver' },
      });
      expect(await resolve(original.id)).toEqual(resolved);
      expect(
        await resolve(original.id, 'new-resolution', 'other-actor'),
      ).toEqual(resolved);
      expect(repository.resolveCoverageNote).toHaveBeenCalledTimes(1);
    },
  );
  it('old note resolution does not affect successor; CREATE replay retains original unresolved result', async () => {
    const original = await create();
    const first = await resolve(original.id);
    const successor = await create('UNAVAILABLE', 'successor');
    expect(await create()).toEqual(original);
    expect(await resolve(original.id, 'again', 'other')).toEqual(first);
    expect(notes.find((n) => n.id === successor.id)?.resolvedAt).toBeNull();
  });
  it('resolve key reused for another note is 409', async () => {
    const original = await create();
    await resolve(original.id);
    const next = await create('UNAVAILABLE', 'next');
    await expect(resolve(next.id)).rejects.toMatchObject({
      status: 409,
      response: { code: 'IDEMPOTENCY_KEY_REUSED' },
    });
  });
  it.each(['case', 'requirement', 'relationship', 'note'])(
    'uses same 404 for missing/foreign %s',
    async (missing) => {
      if (missing === 'case')
        repository.lockCoverageCase.mockResolvedValue(false);
      if (missing === 'requirement')
        repository.findRequirement.mockResolvedValue(null);
      if (missing === 'relationship')
        repository.findRequirement.mockResolvedValue(
          requirement('ACTIVE', 'other-case'),
        );
      await expect(resolve('missing')).rejects.toMatchObject({
        status: 404,
        response: { code: 'REQUIREMENT_NOT_FOUND' },
      });
      expectZeroWrite();
    },
  );
  it('completed replay still validates parent relationship', async () => {
    await create();
    repository.findRequirement.mockResolvedValue(
      requirement('ACTIVE', 'other-case'),
    );
    await expect(create()).rejects.toMatchObject({ status: 404 });
    expect(repository.createCoverageNote).toHaveBeenCalledTimes(1);
  });
  it('looks up claims exclusively within JWT Company and scope', async () => {
    await create();
    expect(repository.findIdempotencyRecord).toHaveBeenCalledWith(
      'company',
      'create',
      'HEALTHCARE_EQUIPMENT_COVERAGE_NOTE_CREATE',
      tx,
    );
    repository.lockCoverageCase.mockResolvedValue(false);
    await expect(
      service.create('foreign', 'actor', 'case', 'requirement', 'create', {
        kind: 'UNAVAILABLE',
        comment: 'Context',
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(repository.findIdempotencyRecord).toHaveBeenLastCalledWith(
      'foreign',
      'create',
      'HEALTHCARE_EQUIPMENT_COVERAGE_NOTE_CREATE',
      tx,
    );
  });
  it.each(['create', 'resolve'])(
    'rolls back %s and claim when finalization fails',
    async (operation) => {
      const original = operation === 'resolve' ? await create() : null;
      const before = structuredClone({ notes, claims });
      repository.completeIdempotencyClaim.mockRejectedValue(
        new Error('private persistence detail'),
      );
      await expect(
        operation === 'resolve' ? resolve(original!.id) : create(),
      ).rejects.toMatchObject({
        status: 500,
        response: { code: 'HEALTHCARE_PERSISTENCE_ERROR' },
      });
      expect({ notes, claims }).toEqual(before);
    },
  );
  it('sanitizes active-kind unique-index final defense to 409', async () => {
    repository.createCoverageNote.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('private', {
        code: 'P2002',
        clientVersion: 'test',
        meta: {
          target: 'HealthcareEquipmentRequirementCoverageNote_open_kind_key',
        },
      }),
    );
    await expect(create()).rejects.toMatchObject({
      status: 409,
      response: { code: 'RESOURCE_STATE_CHANGED' },
    });
    expect(notes).toEqual([]);
    expect(claims.size).toBe(0);
  });
  it('recognizes the exact CoverageNote model plus unique field target', async () => {
    repository.createCoverageNote.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('private', {
        code: 'P2002',
        clientVersion: 'test',
        meta: {
          modelName: 'HealthcareEquipmentRequirementCoverageNote',
          target: ['companyId', 'requirementId', 'kind'],
        },
      }),
    );
    await expect(create()).rejects.toMatchObject({
      status: 409,
      response: { code: 'RESOURCE_STATE_CHANGED' },
    });
    expect(claims.size).toBe(0);
  });
  it.each([
    undefined,
    {},
    { target: null },
    { target: 42 },
    { target: ['companyId', 'requirementId', 'kind'] },
    { target: 'IdempotencyRecord_companyId_scope_key_key' },
    {
      target: 'prefix_HealthcareEquipmentRequirementCoverageNote_open_kind_key',
    },
    {
      modelName: 'OtherModel',
      target: 'HealthcareEquipmentRequirementCoverageNote_open_kind_key',
    },
    { modelName: 'OtherModel', target: ['companyId', 'requirementId', 'kind'] },
    { modelName: 'HealthcareEquipmentRequirementCoverageNote', target: ['id'] },
    {
      modelName: 'HealthcareEquipmentRequirementCoverageNote',
      target: ['companyId', 'requirementId', 'kind', 'extra'],
    },
  ])(
    'sanitizes unrelated or malformed P2002 metadata %j as persistence failure',
    async (meta) => {
      repository.createCoverageNote.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'private SQL and credential marker',
          { code: 'P2002', clientVersion: 'test', meta },
        ),
      );
      await expect(create()).rejects.toMatchObject({
        status: 500,
        response: { code: 'HEALTHCARE_PERSISTENCE_ERROR' },
      });
      expect(claims.size).toBe(0);
      expect(notes).toEqual([]);
    },
  );
  it('orders Case, Requirement, Note locks and shares transaction for resolve', async () => {
    const note = await create();
    jest.clearAllMocks();
    await resolve(note.id);
    expect(
      repository.lockCoverageCase.mock.invocationCallOrder[0],
    ).toBeLessThan(repository.lockRequirement.mock.invocationCallOrder[0]);
    expect(repository.lockRequirement.mock.invocationCallOrder[0]).toBeLessThan(
      repository.lockCoverageNote.mock.invocationCallOrder[0],
    );
    expect(repository.resolveCoverageNote).toHaveBeenCalledWith(
      tx,
      'company',
      'requirement',
      note.id,
      'resolver',
    );
    // The model exposes no Assignment, asset, stock or inventory mutation API.
  });
});
