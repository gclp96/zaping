import { createHash } from 'node:crypto';
import { createReconciliationRequestHash as hash } from './healthcare-case-reconciliation-request-hash';
import {
  ReconciliationCommandContext as Context,
  ReconciliationCommandIntent as Intent,
} from './healthcare-case-reconciliation-command.types';
const c: Context = {
  companyId: 'company',
  actorId: 'actor',
  caseId: 'case',
  reconciliationId: 'rr',
  itemId: 'item',
  key: 'key',
};
const intents: Intent[] = [
  {
    operation: 'CREATE',
    dto: { dispatchId: 'dispatch', observation: ' note ' },
  },
  {
    operation: 'ITEM_ADD',
    dto: { expectedRevision: 1, sourceDispatchItemId: 'source' },
  },
  {
    operation: 'OUTCOME_SET',
    dto: { expectedRevision: 1, type: 'MATERIAL', returnedQty: 1, usedQty: 2 },
  },
  {
    operation: 'OUTCOME_SET',
    dto: {
      expectedRevision: 1,
      type: 'EQUIPMENT',
      outcome: 'RETURNED',
      reportedCondition: 'GOOD',
    },
  },
  {
    operation: 'ITEM_EXCLUDE',
    dto: { expectedRevision: 1, reason: ' reason ' },
  },
  { operation: 'CANCEL', dto: { expectedRevision: 1, reason: ' reason ' } },
];
describe('Reconciliation request hash V1', () => {
  it.each(intents)(
    '$operation is deterministic and ignores authenticated actor/key',
    (i) => {
      expect(hash(c, i)).toMatch(/^[a-f0-9]{64}$/);
      expect(hash(c, i)).toBe(
        hash({ ...c, actorId: 'later', key: 'another' }, i),
      );
      expect(hash(c, i)).not.toBe(hash({ ...c, companyId: 'foreign' }, i));
    },
  );
  it('has exact stable CREATE JSON', () => {
    expect(hash(c, intents[0])).toBe(
      createHash('sha256')
        .update(
          JSON.stringify({
            version: 1,
            operation: 'CREATE',
            companyId: 'company',
            caseId: 'case',
            dispatchId: 'dispatch',
            observation: 'note',
          }),
        )
        .digest('hex'),
    );
  });
  it('normalizes omitted/null observation', () => {
    expect(
      hash(c, { operation: 'CREATE', dto: { dispatchId: 'dispatch' } }),
    ).toBe(
      hash(c, {
        operation: 'CREATE',
        dto: { dispatchId: 'dispatch', observation: null },
      }),
    );
  });
  it('normalizes reason and includes route/revision', () => {
    const i: Intent = {
      operation: 'CANCEL',
      dto: { expectedRevision: 1, reason: 'r' },
    };
    expect(hash(c, i)).toBe(
      hash(c, {
        operation: 'CANCEL',
        dto: { expectedRevision: 1, reason: ' r ' },
      }),
    );
    expect(hash(c, i)).not.toBe(
      hash(c, {
        operation: 'CANCEL',
        dto: { expectedRevision: 2, reason: 'r' },
      }),
    );
    expect(hash(c, i)).not.toBe(hash({ ...c, reconciliationId: 'other' }, i));
  });
  it('hashes every outcome field', () => {
    const i: Intent = {
      operation: 'OUTCOME_SET',
      dto: {
        expectedRevision: 1,
        type: 'MATERIAL',
        returnedQty: 1,
        usedQty: 0,
      },
    };
    expect(hash(c, i)).not.toBe(
      hash(c, { ...i, dto: { ...i.dto, usedQty: 1 } }),
    );
    expect(hash(c, i)).not.toBe(hash({ ...c, itemId: 'other' }, i));
  });
});
