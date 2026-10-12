import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { HealthcareEquipmentAssignmentsRepository } from '../../src/healthcare/equipment-assignments/healthcare-equipment-assignments.repository';
import { C5bKitFixture, createC5bControl } from './healthcare-c5b-control';
import { c5bCheckShape, c5bExpectedPrivilege } from './healthcare-c5b-harness';

describe('C5B Case Availability safety (pure, no database)', () => {
  it.each(['HealthcareCaseKit', 'HealthcareCaseKitItem'])(
    '%s admits only SELECT without inheriting fixture DML',
    (table) => {
      expect(c5bExpectedPrivilege('public', table, 'SELECT')).toBe(true);
      expect(c5bExpectedPrivilege('public', table, 'SELECT', 'id')).toBe(true);
      for (const privilege of [
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER',
        'SELECT WITH GRANT OPTION',
      ]) {
        expect(c5bExpectedPrivilege('public', table, privilege)).toBe(false);
        expect(c5bExpectedPrivilege('public', table, privilege, 'id')).toBe(
          false,
        );
      }
      expect(c5bExpectedPrivilege('other', table, 'SELECT')).toBe(false);
    },
  );
  it('preserves existing DML and column-only CoverageNote resolution', () => {
    for (const table of [
      'Company',
      'User',
      'Product',
      'HealthcareCase',
      'HealthcareCaseRequirement',
      'EquipmentAsset',
      'HealthcareEquipmentAssignment',
      'IdempotencyRecord',
      'HealthcareEquipmentAssignmentConflictOverride',
      'HealthcareEquipmentRequirementCoverageNote',
    ]) {
      for (const privilege of ['SELECT', 'INSERT', 'DELETE'])
        expect(c5bExpectedPrivilege('public', table, privilege)).toBe(true);
      expect(c5bExpectedPrivilege('public', table, 'UPDATE')).toBe(false);
    }
    const table = 'HealthcareEquipmentRequirementCoverageNote';
    for (const column of ['resolvedAt', 'resolvedById'])
      expect(c5bExpectedPrivilege('public', table, 'UPDATE', column)).toBe(
        true,
      );
    for (const column of [
      'companyId',
      'kind',
      'comment',
      'recordedById',
      'createdAt',
    ])
      expect(c5bExpectedPrivilege('public', table, 'UPDATE', column)).toBe(
        false,
      );
    expect(
      c5bExpectedPrivilege(
        'public',
        'HealthcareEquipmentAssignmentSettings',
        'DELETE',
      ),
    ).toBe(false);
    expect(c5bExpectedPrivilege('public', 'InventoryMovement', 'SELECT')).toBe(
      false,
    );
  });
  it('normalizes Kit enum casts without erasing audit boolean grouping', () => {
    const expected = `("status" = 'DRAFT' AND "preparedById" IS NULL AND "preparedAt" IS NULL)
      OR ("status" = 'PREPARED' AND "preparedById" IS NOT NULL AND "preparedAt" IS NOT NULL)`;
    const catalog = `(((status = 'DRAFT'::"HealthcareCaseKitStatus") AND ("preparedById" IS NULL) AND ("preparedAt" IS NULL)) OR
      ((status = 'PREPARED'::"HealthcareCaseKitStatus") AND ("preparedById" IS NOT NULL) AND ("preparedAt" IS NOT NULL)))`;
    expect(c5bCheckShape(catalog)).toBe(c5bCheckShape(expected));
    expect(
      c5bCheckShape(`"lifecycle" = 'ACTIVE'::"HealthcareCaseKitItemLifecycle"`),
    ).toBe(c5bCheckShape(`"lifecycle" = 'ACTIVE'`));
    expect(c5bCheckShape(expected.replace(')\n      OR (', ' AND '))).not.toBe(
      c5bCheckShape(expected),
    );
    expect(
      c5bCheckShape(
        '((char_length(btrim("exclusionReason")) >= 1) AND (char_length(btrim("exclusionReason")) <= 1000))',
      ),
    ).toBe(
      c5bCheckShape(
        'char_length(btrim("exclusionReason")) >= 1 AND char_length(btrim("exclusionReason")) <= 1000',
      ),
    );
  });

  const owner = {
    id: 'tenant',
    userId: 'actor',
    name: 'owned',
    rfc: 'owned-rfc',
  };
  const fixture = (): C5bKitFixture => ({
    id: 'kit',
    companyId: owner.id,
    caseId: 'case',
    status: 'PREPARED',
    items: [
      {
        id: 'quantity-item',
        requirementId: 'requirement',
        preparedQuantity: 2,
      },
      {
        id: 'assignment-item',
        equipmentAssignmentId: 'assignment',
        excluded: true,
      },
    ],
  });
  const setup = () => {
    const tx = {
      company: { count: jest.fn().mockResolvedValue(1) },
      user: { count: jest.fn().mockResolvedValue(1) },
      healthcareCase: { count: jest.fn().mockResolvedValue(1) },
      healthcareCaseRequirement: { count: jest.fn().mockResolvedValue(1) },
      healthcareEquipmentAssignment: { count: jest.fn().mockResolvedValue(1) },
      healthcareCaseKit: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      healthcareCaseKitItem: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      inventoryBatch: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryMovement: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const transaction = jest.fn(
      (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );
    const boundary = jest.fn().mockResolvedValue(undefined);
    const control = createC5bControl({
      concurrent: {} as PrismaService,
      operator: { $transaction: transaction } as unknown as PrismaService,
      pids: [11, 22, 33],
      owners: [owner],
      repository: new HealthcareEquipmentAssignmentsRepository(
        {} as PrismaService,
      ),
      checkBoundary: boundary,
    });
    return { tx, control, transaction, boundary };
  };
  it('creates valid PREPARED/EXCLUDED audit and deletes children before parents using immutable owned IDs', async () => {
    const { control, tx } = setup();
    const input = fixture();
    await control.createCaseKit(input);
    expect(tx.healthcareCaseKit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'kit',
        companyId: owner.id,
        caseId: 'case',
        createdById: owner.userId,
        status: 'PREPARED',
        preparedById: owner.userId,
        preparedAt: expect.any(Date) as Date,
      }) as unknown,
    });
    expect(tx.healthcareCaseKitItem.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        id: 'assignment-item',
        requirementId: null,
        preparedQuantity: null,
        equipmentAssignmentId: 'assignment',
        lifecycle: 'EXCLUDED',
        excludedById: owner.userId,
        excludedAt: expect.any(Date) as Date,
      }) as unknown,
    });
    input.id = 'foreign-kit';
    input.items[0].id = 'foreign-item';
    tx.healthcareCaseKit.count.mockResolvedValue(1);
    tx.healthcareCaseKitItem.count.mockResolvedValue(2);
    await control.cleanupCaseKits();
    expect(tx.healthcareCaseKitItem.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['quantity-item', 'assignment-item'] },
        companyId: owner.id,
        caseId: 'case',
        caseKitId: 'kit',
        addedById: owner.userId,
      },
    });
    expect(tx.healthcareCaseKit.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'kit',
        companyId: owner.id,
        caseId: 'case',
        createdById: owner.userId,
      },
    });
    expect(
      tx.healthcareCaseKitItem.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.healthcareCaseKit.deleteMany.mock.invocationCallOrder[0]);
  });
  it.each([
    'company',
    'user',
    'healthcareCase',
    'healthcareCaseRequirement',
    'healthcareEquipmentAssignment',
  ] as const)(
    'rejects unaccredited %s before INSERT or registration',
    async (delegate) => {
      const { control, tx } = setup();
      tx[delegate].count.mockResolvedValue(0);
      await expect(control.createCaseKit(fixture())).rejects.toThrow();
      await control.cleanupCaseKits();
      expect(tx.healthcareCaseKit.create).not.toHaveBeenCalled();
      expect(tx.healthcareCaseKit.deleteMany).not.toHaveBeenCalled();
    },
  );
  it('rejects foreign tenants, ID collisions and duplicate item identities', async () => {
    const { control, tx, transaction } = setup();
    await expect(
      control.createCaseKit({ ...fixture(), companyId: 'foreign' }),
    ).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
    const duplicate = fixture();
    duplicate.items[1].id = duplicate.items[0].id;
    await expect(control.createCaseKit(duplicate)).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
    tx.healthcareCaseKit.count.mockResolvedValue(1);
    await expect(control.createCaseKit(fixture())).rejects.toThrow();
    await control.cleanupCaseKits();
    expect(tx.healthcareCaseKit.deleteMany).not.toHaveBeenCalled();
  });
  it('retains exact registered identifiers after an uncertain INSERT failure', async () => {
    const { control, tx } = setup();
    tx.healthcareCaseKitItem.create.mockRejectedValueOnce(
      new Error('uncertain insert'),
    );
    await expect(control.createCaseKit(fixture())).rejects.toThrow();
    await control.cleanupCaseKits();
    expect(tx.healthcareCaseKitItem.deleteMany).toHaveBeenCalled();
    expect(tx.healthcareCaseKit.deleteMany).toHaveBeenCalled();
  });
  it.each(['company', 'healthcareCase', 'unknown child', 'changed kit'])(
    'fails closed during cleanup for %s',
    async (failure) => {
      const { control, tx } = setup();
      await control.createCaseKit(fixture());
      tx.healthcareCaseKit.count.mockResolvedValue(1);
      tx.healthcareCaseKitItem.count.mockResolvedValue(2);
      if (failure === 'company') tx.company.count.mockResolvedValue(0);
      if (failure === 'healthcareCase')
        tx.healthcareCase.count.mockResolvedValue(0);
      if (failure === 'unknown child')
        tx.healthcareCaseKitItem.count
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(3);
      if (failure === 'changed kit')
        tx.healthcareCaseKit.count
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(0);
      await expect(control.cleanupCaseKits()).rejects.toThrow();
      expect(tx.healthcareCaseKitItem.deleteMany).not.toHaveBeenCalled();
      expect(tx.healthcareCaseKit.deleteMany).not.toHaveBeenCalled();
    },
  );
  it('never deletes the parent after a child deletion error', async () => {
    const { control, tx } = setup();
    await control.createCaseKit(fixture());
    tx.healthcareCaseKitItem.deleteMany.mockRejectedValueOnce(
      new Error('cleanup failed'),
    );
    await expect(control.cleanupCaseKits()).rejects.toThrow();
    expect(tx.healthcareCaseKit.deleteMany).not.toHaveBeenCalled();
  });
  it('rejects unknown-session boundaries before fixture writes, cleanup and inventory observation', async () => {
    const { control, tx, boundary } = setup();
    await control.createCaseKit(fixture());
    boundary.mockRejectedValue(new Error('unknown session'));
    await expect(control.cleanupCaseKits()).rejects.toThrow();
    await expect(control.observeInventory()).rejects.toThrow();
    await expect(
      control.createCaseKit({
        ...fixture(),
        id: 'kit2',
        caseId: 'case2',
        items: [],
      }),
    ).rejects.toThrow();
    expect(tx.healthcareCaseKit.deleteMany).not.toHaveBeenCalled();
    expect(tx.inventoryMovement.findMany).not.toHaveBeenCalled();
    expect(tx.healthcareCaseKit.create).toHaveBeenCalledTimes(1);
  });
  it('observes inventory only for accredited fixture tenants, with no application grants', async () => {
    const { control, tx, transaction } = setup();
    expect(await control.observeInventory()).toEqual({
      batches: [],
      movements: [],
    });
    for (const delegate of [tx.inventoryBatch, tx.inventoryMovement])
      expect(delegate.findMany).toHaveBeenCalledWith({
        where: { companyId: { in: [owner.id] } },
        orderBy: { id: 'asc' },
      });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
    tx.company.count.mockResolvedValue(0);
    tx.inventoryMovement.findMany.mockClear();
    await expect(control.observeInventory()).rejects.toThrow();
    expect(tx.inventoryMovement.findMany).not.toHaveBeenCalled();
  });
});
