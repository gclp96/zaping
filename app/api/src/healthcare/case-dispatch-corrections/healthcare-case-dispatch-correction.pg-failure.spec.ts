import {
  correctionPgFailure,
  isDispatchCorrectionDuplicate,
  correctionBarrier,
  correctionDeadline,
  isCorrectionCheckViolation,
  assertCorrectionRejection,
  isCorrectionRejection,
} from '../../../test/helpers/dispatch-correction-pg-failure';
import { Prisma } from '@prisma/client';

// Deliberately model arbitrary rejection reasons, including malformed errors.
function rejectWith(error: unknown): Promise<never> {
  return Promise.resolve().then(() => {
    throw error;
  });
}

describe('correction QA PostgreSQL failure discrimination (no database)', () => {
  const sourceFk =
    'HealthcareCaseDispatchCorrectionItem_sourceDispatchItemId__fkey';
  describe.each(['DispatchCorrectionItem_shape', 'DispatchCorrection_shape'])(
    'serialized CHECK %s',
    (constraint) => {
      const expected = { kind: 'check', constraint } as const;
      const message = (name: string) =>
        `new row for relation "HealthcareCaseDispatchCorrection" violates check constraint "${name}"`;
      function connectorError(
        diagnostic = message(constraint),
        code = '23514',
      ) {
        return new Prisma.PrismaClientUnknownRequestError(
          `Error occurred during query execution:\nConnectorError(ConnectorError { kind: QueryError(PostgresError { code: "${code}", message: ${JSON.stringify(diagnostic)}, severity: "ERROR", constraint: None }), transient: false })`,
          { clientVersion: '6.19.3' },
        );
      }
      it('accepts the exact decoded identifier from the real Prisma envelope', async () => {
        const error = connectorError();
        expect(correctionPgFailure(error)).toMatchObject({
          code: '23514',
          constraint: null,
          diagnostic: message(constraint),
        });
        await expect(
          assertCorrectionRejection(rejectWith(error), expected),
        ).resolves.toMatchObject({ code: '23514', kind: 'check' });
      });
      it('accepts structured DbError metadata without inventing a code', () => {
        const error = new Prisma.PrismaClientKnownRequestError(
          'CHECK rejected',
          {
            code: 'P2004',
            clientVersion: '6.19.3',
            meta: {
              database_error: `DbError { code: SqlState(E23514), message: ${JSON.stringify(message(constraint))}, constraint: None }`,
            },
          },
        );
        expect(isCorrectionRejection(error, expected)).toBe(true);
        expect(correctionPgFailure(error).code).toBe('23514');
      });
      it.each(['P2028', 'P1001', '55P03', '40P01', '23503', '42702'])(
        'rejects incompatible code %s',
        (code) => {
          const error = connectorError(message(constraint), code);
          expect(isCorrectionRejection(error, expected)).toBe(false);
        },
      );
      it.each([
        'Another_check',
        constraint + '_suffix',
        constraint.slice(0, -1),
      ])('rejects a different or partial identifier %s', (name) => {
        expect(
          isCorrectionRejection(connectorError(message(name)), expected),
        ).toBe(false);
      });
      it('rejects generic text, wrong constraint syntax and JavaScript imitations', () => {
        for (const diagnostic of [
          constraint,
          `constraint "${constraint}"`,
          `violates foreign key constraint "${constraint}"`,
        ])
          expect(
            isCorrectionRejection(connectorError(diagnostic), expected),
          ).toBe(false);
        const real = connectorError();
        for (const error of [
          new Error(real.message),
          { name: real.name, message: real.message },
        ])
          expect(isCorrectionRejection(error, expected)).toBe(false);
      });
      it('rejects conflicting structured metadata in either direction', () => {
        for (const [diagnostic, meta] of [
          [message(constraint), { constraint: 'Another_check' }],
          [message('Another_check'), { constraint }],
          [
            message(constraint),
            { constraint, database_error: { constraint: 'Another_check' } },
          ],
        ] as const) {
          const error = connectorError(diagnostic);
          Object.assign(error, { meta });
          expect(isCorrectionRejection(error, expected)).toBe(false);
        }
      });
    },
  );
  it('requires the specific raw-query FK rejection', async () => {
    await expect(
      assertCorrectionRejection(
        rejectWith({
          code: 'P2010',
          meta: {
            code: '23503',
            message: `insert or update on table "HealthcareCaseDispatchCorrectionItem" violates foreign key constraint "${sourceFk}"`,
          },
        }),
        { kind: 'foreign-key', constraint: sourceFk },
      ),
    ).resolves.toMatchObject({ code: '23503' });
  });
  it.each([sourceFk, sourceFk + ' (index)'])(
    'accepts exact P2003 field metadata: %s',
    async (field_name) => {
      await expect(
        assertCorrectionRejection(
          rejectWith({ code: 'P2003', meta: { field_name } }),
          { kind: 'foreign-key', constraint: sourceFk },
        ),
      ).resolves.toMatchObject({ kind: 'foreign-key' });
    },
  );
  it('accepts a named CHECK and the exact source uniqueness target', async () => {
    await expect(
      assertCorrectionRejection(
        rejectWith({
          code: 'P2010',
          meta: {
            code: '23514',
            message:
              'new row violates check constraint "DispatchCorrection_shape"',
          },
        }),
        { kind: 'check', constraint: 'DispatchCorrection_shape' },
      ),
    ).resolves.toMatchObject({ code: '23514' });
    await expect(
      assertCorrectionRejection(
        rejectWith({
          code: 'P2002',
          meta: {
            target: ['companyId', 'correctionId', 'sourceDispatchItemId'],
          },
        }),
        {
          kind: 'duplicate',
          constraint: 'DispatchCorrectionItem_source_key',
          target: ['companyId', 'correctionId', 'sourceDispatchItemId'],
        },
      ),
    ).resolves.toMatchObject({ kind: 'duplicate' });
  });
  it('does not accept a fulfilled operation as a rejection', async () => {
    await expect(
      assertCorrectionRejection(Promise.resolve(undefined), {
        kind: 'check',
        messages: ['Correction unsealed item'],
      }),
    ).rejects.toThrow('Expected correction rejection');
    for (const error of [undefined, new Error('Correction unsealed item')]) {
      await expect(
        assertCorrectionRejection(rejectWith(error), {
          kind: 'check',
          messages: ['Correction unsealed item'],
        }),
      ).rejects.toThrow('Unexpected correction rejection');
    }
  });
  it.each([
    'P2028',
    'P2024',
    'P1001',
    'P2034',
    '55P03',
    '40P01',
    '57014',
    '42702',
  ])(
    'rejects %s even when its message contains the Correction invocation and expected diagnostic',
    async (code) => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Invalid tx.healthcareCaseDispatchCorrection.update() invocation: Correction unsealed item',
        { code, clientVersion: '6.19.3' },
      );
      await expect(
        assertCorrectionRejection(rejectWith(error), {
          kind: 'check',
          messages: ['Correction unsealed item'],
        }),
      ).rejects.toThrow('Unexpected correction rejection');
      await expect(
        assertCorrectionRejection(rejectWith(error), {
          kind: 'foreign-key',
          constraint: sourceFk,
        }),
      ).rejects.toThrow('Unexpected correction rejection');
    },
  );
  it('rejects another FK, CHECK, uniqueness target, or a contradictory constraint', async () => {
    for (const error of [
      { code: 'P2003', meta: { field_name: 'Another_fkey (index)' } },
      {
        code: 'P2010',
        meta: {
          code: '23503',
          message: 'violates foreign key constraint "Another_fkey"',
        },
      },
      { code: 'P2003' },
    ])
      await expect(
        assertCorrectionRejection(rejectWith(error), {
          kind: 'foreign-key',
          constraint: sourceFk,
        }),
      ).rejects.toThrow('Unexpected correction rejection');
    await expect(
      assertCorrectionRejection(
        rejectWith({
          code: '23514',
          meta: { constraint: 'Another_check' },
        }),
        { kind: 'check', constraint: 'DispatchCorrection_shape' },
      ),
    ).rejects.toThrow('Unexpected correction rejection');
    await expect(
      assertCorrectionRejection(
        rejectWith({ code: 'P2002', meta: { target: ['id'] } }),
        {
          kind: 'duplicate',
          constraint: 'DispatchCorrectionItem_source_key',
          target: ['companyId', 'correctionId', 'sourceDispatchItemId'],
        },
      ),
    ).rejects.toThrow('Unexpected correction rejection');
    await expect(
      assertCorrectionRejection(
        rejectWith({
          code: 'P2002',
          meta: {
            constraint: 'Another_key',
            target: ['companyId', 'correctionId', 'sourceDispatchItemId'],
          },
        }),
        {
          kind: 'duplicate',
          constraint: 'DispatchCorrectionItem_source_key',
          target: ['companyId', 'correctionId', 'sourceDispatchItemId'],
        },
      ),
    ).rejects.toThrow('Unexpected correction rejection');
  });
  it('accepts only the intended Dispatch uniqueness violation', () => {
    expect(
      isDispatchCorrectionDuplicate({
        code: 'P2002',
        meta: { target: ['companyId', 'dispatchId'] },
      }),
    ).toBe(true);
    expect(
      isDispatchCorrectionDuplicate({
        code: '23505',
        meta: { constraint: 'DispatchCorrection_dispatch_key' },
      }),
    ).toBe(true);
    expect(
      isDispatchCorrectionDuplicate({
        code: 'P2002',
        meta: { target: ['id'] },
      }),
    ).toBe(false);
    expect(
      isDispatchCorrectionDuplicate({
        code: '23505',
        meta: { constraint: 'DispatchCorrectionItem_source_key' },
      }),
    ).toBe(false);
  });
  it.each([
    ['55P03', 'lock-timeout'],
    ['40P01', 'deadlock'],
    ['57014', 'statement-cancelled'],
    ['P2028', 'transaction-timeout'],
    ['P2024', 'pool-timeout'],
    ['P2034', 'transaction-conflict'],
  ])('distinguishes %s and never accepts it as duplicate', (code, kind) => {
    expect(correctionPgFailure({ code }).kind).toBe(kind);
    expect(isDispatchCorrectionDuplicate({ code })).toBe(false);
  });
  it('extracts raw SQLSTATE from Prisma raw-query errors', () => {
    expect(
      correctionPgFailure({ code: 'P2010', meta: { code: '23514' } }).kind,
    ).toBe('check');
    expect(
      correctionPgFailure({
        code: 'P2004',
        meta: {
          database_error:
            'PostgresError { code: SqlState(E23514), constraint: Some("DispatchCorrection_dependencies_sealed") }',
        },
      }),
    ).toMatchObject({
      kind: 'check',
      code: '23514',
      constraint: 'DispatchCorrection_dependencies_sealed',
    });
  });
  it('does not interpret incidental message text as SQLSTATE evidence', () => {
    expect(isDispatchCorrectionDuplicate(new Error('23505 timeout'))).toBe(
      false,
    );
    expect(correctionPgFailure(null).kind).toBe('other');
  });
  const expectedCheck = {
    messages: ['Correction unsealed item'],
  };
  const connectorPrefix =
    'Error in connector: Error querying the database: ERROR: ';
  it.each([
    'Correction contains unreferenced compensating Effect',
    'Correction unsealed item',
    'Correction terminal root snapshot malformed',
  ])('recognizes the exact Prisma Display wrapper: %s', (diagnostic) => {
    const error = new Prisma.PrismaClientUnknownRequestError(
      connectorPrefix + diagnostic,
      { clientVersion: '6.19.3' },
    );
    expect(correctionPgFailure(error)).toMatchObject({
      kind: 'check',
      code: null,
      constraint: null,
      diagnostic,
    });
    expect(isCorrectionCheckViolation(error, { messages: [diagnostic] })).toBe(
      true,
    );
    expect(
      isCorrectionCheckViolation(error, { messages: ['Another validator'] }),
    ).toBe(false);
    expect(isDispatchCorrectionDuplicate(error)).toBe(false);
    if (diagnostic === 'Correction contains unreferenced compensating Effect') {
      expect(connectorPrefix.length).toBe(56);
      expect(diagnostic.length).toBe(52);
      expect(error.message.length).toBe(108);
      expect(error.message.indexOf(diagnostic)).toBe(56);
    }
  });
  it.each([
    'Error in connector: ',
    'Error querying the database: ERROR: ',
    'Error in connector: Error querying the database: ',
    'error in connector: Error querying the database: ERROR: ',
    'Error in connector: Error querying the database: WARNING: ',
    'Error in connector: Error querying the database: ERROR:',
    'Error in connector: Error querying the database: ERROR:  ',
    ' ' + connectorPrefix,
    '\n' + connectorPrefix,
    connectorPrefix + connectorPrefix,
  ])('rejects an unapproved connector prefix: %s', (prefix) => {
    const diagnostic = 'Correction contains unreferenced compensating Effect';
    const error = new Prisma.PrismaClientUnknownRequestError(
      prefix + diagnostic,
      {
        clientVersion: '6.19.3',
      },
    );
    expect(correctionPgFailure(error)).toMatchObject({
      kind: 'other',
      code: null,
      diagnostic: null,
    });
    expect(isCorrectionCheckViolation(error, { messages: [diagnostic] })).toBe(
      false,
    );
  });
  it.each([
    'Correction contains unreferenced compensating',
    'Correction contains unreferenced compensating Effect extra',
    'Correction contains unreferenced compensating Effect ',
    'Correction contains unreferenced compensating Effect\n',
    'Correction contains unreferenced compensating Effect\nDETAIL: extra',
    'prefix: Correction contains unreferenced compensating Effect',
  ])(
    'rejects partial diagnostics or additional content after the exact prefix: %s',
    (text) => {
      const error = new Prisma.PrismaClientUnknownRequestError(
        connectorPrefix + text,
        {
          clientVersion: '6.19.3',
        },
      );
      expect(correctionPgFailure(error)).toMatchObject({
        kind: 'other',
        code: null,
        diagnostic: null,
      });
      expect(isCorrectionCheckViolation(error, { messages: [text] })).toBe(
        false,
      );
    },
  );
  it('requires a real Prisma unknown request error for the Display wrapper', () => {
    const diagnostic = 'Correction contains unreferenced compensating Effect';
    const message = connectorPrefix + diagnostic;
    for (const error of [
      new Error(message),
      Object.assign(new Error(message), {
        name: 'PrismaClientUnknownRequestError',
        clientVersion: '6.19.3',
      }),
      {
        name: 'PrismaClientUnknownRequestError',
        clientVersion: '6.19.3',
        message,
      },
      new Prisma.PrismaClientInitializationError(message, '6.19.3'),
    ]) {
      expect(
        isCorrectionCheckViolation(error, { messages: [diagnostic] }),
      ).toBe(false);
    }
  });
  it('preserves contradictory codes and metadata for a prefixed Prisma error', () => {
    const diagnostic = 'Correction contains unreferenced compensating Effect';
    for (const extra of [
      ...[
        'P1001',
        'P2028',
        'P2024',
        'P2034',
        '55P03',
        '40P01',
        '57014',
        '42702',
      ].map((code) => ({ code })),
      { meta: { code: 'P2028' } },
      { meta: { code: '23503' } },
      { meta: { database_error: { code: '55P03' } } },
      { meta: { database_error: 'Unrelated server failure' } },
      { meta: { message: 'Unrelated metadata diagnostic' } },
    ]) {
      const error = Object.assign(
        new Prisma.PrismaClientUnknownRequestError(
          connectorPrefix + diagnostic,
          { clientVersion: '6.19.3' },
        ),
        extra,
      );
      expect(
        isCorrectionCheckViolation(error, { messages: [diagnostic] }),
      ).toBe(false);
    }
  });
  it('rejects a conflicting constraint for an otherwise exact prefixed seal diagnostic', () => {
    const diagnostic =
      'Correction dependencies sealed until creating transaction commits';
    const expected = {
      messages: [diagnostic],
      constraint: 'DispatchCorrection_dependencies_sealed',
    };
    const error = new Prisma.PrismaClientUnknownRequestError(
      connectorPrefix + diagnostic,
      { clientVersion: '6.19.3' },
    );
    expect(isCorrectionCheckViolation(error, expected)).toBe(true);
    Object.assign(error, { meta: { constraint: 'Another_check' } });
    expect(isCorrectionCheckViolation(error, expected)).toBe(false);
  });
  it.each([
    'Correction contains unreferenced compensating Effect',
    'Correction unsealed item',
    'Correction terminal root snapshot malformed',
  ])('recognizes the exact diagnostic-only Prisma rejection: %s', (message) => {
    const error = new Prisma.PrismaClientUnknownRequestError(message, {
      clientVersion: '6.19.3',
    });
    expect(correctionPgFailure(error)).toMatchObject({
      kind: 'check',
      code: null,
      constraint: null,
      diagnostic: message,
    });
    expect(isCorrectionCheckViolation(error, { messages: [message] })).toBe(
      true,
    );
    expect(
      isCorrectionCheckViolation(error, { messages: ['Another validator'] }),
    ).toBe(false);
    expect(isDispatchCorrectionDuplicate(error)).toBe(false);
  });
  it('requires a Prisma error instance, not a generic error or a spoofed name', () => {
    const message = 'Correction contains unreferenced compensating Effect';
    for (const error of [
      undefined,
      null,
      message,
      new Error(message),
      Object.assign(new Error(message), {
        name: 'PrismaClientUnknownRequestError',
        clientVersion: '6.19.3',
      }),
      {
        name: 'PrismaClientUnknownRequestError',
        clientVersion: '6.19.3',
        message,
      },
      new Prisma.PrismaClientInitializationError(message, '6.19.3'),
    ]) {
      expect(correctionPgFailure(error).kind).toBe('other');
      expect(isCorrectionCheckViolation(error, { messages: [message] })).toBe(
        false,
      );
    }
  });
  it.each([
    'Correction contains unreferenced compensating',
    'Correction contains unreferenced compensating Effect extra',
    'prefix: Correction contains unreferenced compensating Effect',
    ' Correction contains unreferenced compensating Effect',
    'Correction contains unreferenced compensating Effect\n',
    'correction contains unreferenced compensating Effect',
    '23514 Correction contains unreferenced compensating Effect',
    'Connection refused',
    'Unexpected fixture failure',
  ])(
    'does not infer a CHECK from an unapproved or partial message: %s',
    (message) => {
      const error = new Prisma.PrismaClientUnknownRequestError(message, {
        clientVersion: '6.19.3',
      });
      expect(correctionPgFailure(error)).toMatchObject({
        kind: 'other',
        code: null,
      });
      // Even a test accepting this arbitrary text cannot bypass the SQL allowlist.
      expect(isCorrectionCheckViolation(error, { messages: [message] })).toBe(
        false,
      );
    },
  );
  it.each([
    'P1001',
    'P2028',
    'P2024',
    'P2034',
    '55P03',
    '40P01',
    '57014',
    '42702',
  ])(
    'does not override an explicit %s with an exact Prisma diagnostic',
    (code) => {
      const message = 'Correction contains unreferenced compensating Effect';
      const error = Object.assign(
        new Prisma.PrismaClientUnknownRequestError(message, {
          clientVersion: '6.19.3',
        }),
        { code },
      );
      expect(correctionPgFailure(error).code).toBe(code);
      expect(isCorrectionCheckViolation(error, { messages: [message] })).toBe(
        false,
      );
    },
  );
  it('does not override contradictory metadata in a diagnostic-only Prisma error', () => {
    const message = 'Correction contains unreferenced compensating Effect';
    for (const meta of [
      { code: 'P2028' },
      { code: '42702' },
      { database_error: { code: '55P03' } },
      { database_error: 'Unrelated server failure' },
      { message: 'Unrelated metadata diagnostic' },
    ]) {
      const error = Object.assign(
        new Prisma.PrismaClientUnknownRequestError(message, {
          clientVersion: '6.19.3',
        }),
        { meta },
      );
      expect(isCorrectionCheckViolation(error, { messages: [message] })).toBe(
        false,
      );
    }
  });
  it('keeps the expected seal message and conflicting-constraint checks for the new format', () => {
    const message =
      'Correction dependencies sealed until creating transaction commits';
    const expected = {
      messages: [message],
      constraint: 'DispatchCorrection_dependencies_sealed',
    };
    const error = new Prisma.PrismaClientUnknownRequestError(message, {
      clientVersion: '6.19.3',
    });
    expect(isCorrectionCheckViolation(error, expected)).toBe(true);
    Object.assign(error, { meta: { constraint: 'Another_check' } });
    expect(isCorrectionCheckViolation(error, expected)).toBe(false);
  });
  it.each(['23514', '55P03', '40P01', '57014', '42702'])(
    'parses structured COMMIT connector SQLSTATE %s without treating other errors as checks',
    (code) => {
      const error = new Prisma.PrismaClientUnknownRequestError(
        `Error occurred during query execution:\nConnectorError(ConnectorError { kind: QueryError(PostgresError { code: "${code}", message: "Correction unsealed item", severity: "ERROR", constraint: None }), transient: false })`,
        { clientVersion: '6.19.3' },
      );
      expect(correctionPgFailure(error)).toMatchObject({
        code,
        diagnostic: 'Correction unsealed item',
      });
      expect(isCorrectionCheckViolation(error, expectedCheck)).toBe(
        code === '23514',
      );
    },
  );
  it('accepts a metadata-only P2004 diagnostic only for the exact expected validator', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Constraint failed',
      {
        code: 'P2004',
        clientVersion: '6.19.3',
        meta: { database_error: 'db error: ERROR: Correction unsealed item' },
      },
    );
    expect(isCorrectionCheckViolation(error, expectedCheck)).toBe(true);
    expect(
      isCorrectionCheckViolation(error, {
        messages: ['Correction material evidence incompatible'],
      }),
    ).toBe(false);
  });
  it('parses a structured DbError inside P2004 database metadata', () => {
    const error = {
      code: 'P2004',
      meta: {
        database_error:
          'Error { kind: Db, cause: Some(DbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E23514), message: "Correction unsealed item", detail: None, constraint: None }) }',
      },
    };
    expect(correctionPgFailure(error)).toMatchObject({
      code: '23514',
      diagnostic: 'Correction unsealed item',
    });
    expect(isCorrectionCheckViolation(error, expectedCheck)).toBe(true);
  });
  it('rejects arbitrary CHECKs and incidental expected text in application errors', () => {
    for (const error of [
      { code: '23514', meta: { message: 'Fixture quantity check failed' } },
      { code: '23514' },
      new Error('Correction unsealed item'),
      new Error(
        'ConnectorError PostgresError { code: "23514", message: "Correction unsealed item" }',
      ),
      { code: 'P2004', message: 'Correction unsealed item' },
      {
        code: 'P2010',
        meta: { code: '42702', message: 'Correction unsealed item' },
      },
    ]) {
      expect(isCorrectionCheckViolation(error, expectedCheck)).toBe(false);
    }
  });
  it.each(['P2028', 'P2024', 'P2034', 'P1001', '55P03', '40P01', '57014'])(
    'never accepts %s even if expected diagnostic text is present',
    (code) => {
      expect(
        isCorrectionCheckViolation(
          { code, meta: { database_error: 'Correction unsealed item' } },
          expectedCheck,
        ),
      ).toBe(false);
    },
  );
  it('requires the specific seal rejection when Prisma omits constraint metadata', () => {
    const expected = {
      constraint: 'DispatchCorrection_dependencies_sealed',
      messages: [
        'Correction dependencies sealed until creating transaction commits',
      ],
    };
    expect(
      isCorrectionCheckViolation(
        {
          code: 'P2010',
          meta: { code: '23514', message: expected.messages[0] },
        },
        expected,
      ),
    ).toBe(true);
    for (const meta of [
      { code: '23514', message: 'Correction material evidence incompatible' },
      {
        code: '23514',
        message: expected.messages[0],
        constraint: 'Another_check',
      },
      { code: '55P03', message: expected.messages[0] },
    ]) {
      expect(
        isCorrectionCheckViolation({ code: 'P2010', meta }, expected),
      ).toBe(false);
    }
  });
  it('uses an explicit release rather than assuming Promise concurrency', async () => {
    const barrier = correctionBarrier();
    let passed = false;
    const task = barrier.promise.then(() => {
      passed = true;
    });
    await Promise.resolve();
    expect(passed).toBe(false);
    barrier.release();
    await correctionDeadline(task, 1000);
    expect(passed).toBe(true);
  });
  it('fails instead of counting synchronization timeout as a successful race', async () => {
    await expect(correctionDeadline(new Promise(() => {}), 5)).rejects.toThrow(
      'synchronization deadline',
    );
  });
});
