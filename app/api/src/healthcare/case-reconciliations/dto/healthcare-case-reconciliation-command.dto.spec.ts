import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { CreateHealthcareCaseReconciliationDto as Create } from './create-healthcare-case-reconciliation.dto';
import { AddHealthcareCaseReconciliationItemDto as Add } from './add-healthcare-case-reconciliation-item.dto';
import { SetHealthcareCaseReconciliationOutcomeDto as Outcome } from './set-healthcare-case-reconciliation-outcome.dto';
import { CancelHealthcareCaseReconciliationDto as Cancel } from './cancel-healthcare-case-reconciliation.dto';
import { ExcludeHealthcareCaseReconciliationItemDto as Exclude } from './exclude-healthcare-case-reconciliation-item.dto';
const id = '11111111-1111-4111-8111-111111111111';
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const parse = (metatype: ArgumentMetadata['metatype'], v: unknown) =>
  pipe.transform(v, { type: 'body', metatype });
describe('Reconciliation strict command DTOs', () => {
  it.each([undefined, null, ' note '])(
    'CREATE optional observation %p',
    async (observation) => {
      const data =
        observation === undefined
          ? { dispatchId: id }
          : { dispatchId: id, observation };
      expect(await parse(Create, data)).toMatchObject({
        dispatchId: id,
        ...(observation === undefined
          ? {}
          : { observation: typeof observation === 'string' ? 'note' : null }),
      });
    },
  );
  it.each(['', '  ', 'x'.repeat(1001), 42])(
    'rejects invalid observation',
    async (observation) => {
      await expect(
        parse(Create, { dispatchId: id, observation }),
      ).rejects.toThrow();
    },
  );
  it.each([Add, Outcome, Cancel, Exclude])(
    'rejects numeric string revision for %p',
    async (dto) => {
      await expect(
        parse(dto, {
          expectedRevision: '0',
          sourceDispatchItemId: id,
          type: 'MATERIAL',
          returnedQty: 0,
          usedQty: 0,
          reason: 'r',
        }),
      ).rejects.toThrow();
    },
  );
  it.each([-1, 2147483647, 0.5, null])(
    'revision bounds %p',
    async (expectedRevision) => {
      await expect(
        parse(Add, { expectedRevision, sourceDispatchItemId: id }),
      ).rejects.toThrow();
    },
  );
  it('neutral ADD derives type, does not accept physical fields', async () => {
    await expect(
      parse(Add, { expectedRevision: 0, sourceDispatchItemId: id }),
    ).resolves.toMatchObject({ expectedRevision: 0 });
    for (const field of [
      'type',
      'productId',
      'batchId',
      'assetId',
      'observation',
    ])
      await expect(
        parse(Add, {
          expectedRevision: 0,
          sourceDispatchItemId: id,
          [field]: 'x',
        }),
      ).rejects.toThrow();
  });
  it.each([
    [0, 0],
    [2147483647, 2147483647],
    [1, 2],
  ])('accepts bounded material %p/%p', async (returnedQty, usedQty) => {
    await expect(
      parse(Outcome, {
        expectedRevision: 0,
        type: 'MATERIAL',
        returnedQty,
        usedQty,
      }),
    ).resolves.toMatchObject({ returnedQty, usedQty });
  });
  it.each([-1, 2147483648, 0.1, '1', null, undefined])(
    'rejects invalid quantity %p',
    async (returnedQty) => {
      await expect(
        parse(Outcome, {
          expectedRevision: 0,
          type: 'MATERIAL',
          returnedQty,
          usedQty: 0,
        }),
      ).rejects.toThrow();
    },
  );
  it.each(['GOOD', 'DAMAGED', 'INSPECTION_PENDING', 'OUT_OF_SERVICE'])(
    'RETURNED %s',
    async (reportedCondition) => {
      await expect(
        parse(Outcome, {
          expectedRevision: 0,
          type: 'EQUIPMENT',
          outcome: 'RETURNED',
          reportedCondition,
        }),
      ).resolves.toMatchObject({ reportedCondition });
    },
  );
  it('UNRESOLVED requires explicit null', async () => {
    await expect(
      parse(Outcome, {
        expectedRevision: 0,
        type: 'EQUIPMENT',
        outcome: 'UNRESOLVED',
        reportedCondition: null,
      }),
    ).resolves.toMatchObject({ reportedCondition: null });
    for (const reportedCondition of ['GOOD', undefined])
      await expect(
        parse(Outcome, {
          expectedRevision: 0,
          type: 'EQUIPMENT',
          outcome: 'UNRESOLVED',
          reportedCondition,
        }),
      ).rejects.toThrow();
  });
  it.each([null, undefined, 'bad'])(
    'RETURNED rejects condition %p',
    async (reportedCondition) => {
      await expect(
        parse(Outcome, {
          expectedRevision: 0,
          type: 'EQUIPMENT',
          outcome: 'RETURNED',
          reportedCondition,
        }),
      ).rejects.toThrow();
    },
  );
  it('rejects wrong discriminator fields and observation patches', async () => {
    for (const extra of [
      { outcome: 'RETURNED' },
      { reportedCondition: null },
      { observation: 'x' },
    ])
      await expect(
        parse(Outcome, {
          expectedRevision: 0,
          type: 'MATERIAL',
          returnedQty: 0,
          usedQty: 0,
          ...extra,
        }),
      ).rejects.toThrow();
  });
  it.each([Cancel, Exclude])('normalizes bounded reason %p', async (dto) => {
    await expect(
      parse(dto, { expectedRevision: 0, reason: ' reason ' }),
    ).resolves.toMatchObject({ reason: 'reason' });
    for (const reason of ['', ' ', 'x'.repeat(1001)])
      await expect(
        parse(dto, { expectedRevision: 0, reason }),
      ).rejects.toThrow();
  });
});
