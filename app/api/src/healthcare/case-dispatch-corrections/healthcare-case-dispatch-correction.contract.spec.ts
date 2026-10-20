import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import {
  assertDispatchCorrectionReplayHash,
  createDispatchCorrectionRequestHash,
  DispatchCorrectionIntent,
} from './healthcare-case-dispatch-correction.contract';

const intent: DispatchCorrectionIntent = {
  companyId: 'company',
  caseId: 'case',
  dispatchId: 'dispatch',
  attestedNoHandoff: true,
  reason: 'Confirmado por error',
};
describe('correction intention v1', () => {
  it('pins the canonical bytes, version and operation', () => {
    expect(createDispatchCorrectionRequestHash(intent)).toBe(
      createHash('sha256')
        .update(
          '{"version":1,"operation":"CORRECT_NO_HANDOFF","companyId":"company","caseId":"case","dispatchId":"dispatch","attestedNoHandoff":true,"reason":"Confirmado por error"}',
        )
        .digest('hex'),
    );
  });
  it('normalizes edge whitespace, preserving meaningful reason text', () => {
    expect(
      createDispatchCorrectionRequestHash({
        ...intent,
        reason: ` ${intent.reason}\n`,
      }),
    ).toBe(createDispatchCorrectionRequestHash(intent));
  });
  it.each(['companyId', 'caseId', 'dispatchId', 'reason'] as const)(
    'separates a different %s',
    (field) => {
      expect(
        createDispatchCorrectionRequestHash({
          ...intent,
          [field]: 'different',
        }),
      ).not.toBe(createDispatchCorrectionRequestHash(intent));
    },
  );
  it.each(['', '   ', 'x'.repeat(1001)])('rejects invalid reason', (reason) => {
    expect(() =>
      createDispatchCorrectionRequestHash({ ...intent, reason }),
    ).toThrow();
  });
  it('requires an explicit true attestation at runtime', () => {
    expect(() =>
      createDispatchCorrectionRequestHash({
        ...intent,
        attestedNoHandoff: false,
      } as unknown as DispatchCorrectionIntent),
    ).toThrow();
  });
  it('accepts replay only for the same intention and reports 409 otherwise', () => {
    expect(() => assertDispatchCorrectionReplayHash('a', 'a')).not.toThrow();
    try {
      assertDispatchCorrectionReplayHash('a', 'b');
      throw new Error('Expected conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getStatus()).toBe(409);
    }
  });
});
