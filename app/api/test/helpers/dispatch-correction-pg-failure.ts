import { Prisma } from '@prisma/client';

// Literal diagnostics raised by the 01B migration with CHECK semantics. This
// allowlist is independent of each test's narrower expected-validator contract.
const CORRECTION_CHECK_DIAGNOSTICS = new Set([
  'Correction requires READ COMMITTED for terminal dependency visibility',
  'Correction must start unsealed in its creating transaction',
  'Correction history cannot be deleted',
  'Correction immutable identity/sealed history',
  'Correction item history cannot be deleted',
  'Correction sealed or missing parent',
  'Correction item immutable identity',
  'Correction dependencies sealed until creating transaction commits',
  'Correction missing',
  'Correction terminal root snapshot malformed',
  'Correction terminal root/attestation/idempotency incomplete',
  'Correction source set/reconciliation incompatible',
  'Correction item source/snapshot incomplete',
  'Correction material evidence incompatible',
  'Correction equipment evidence incompatible',
  'Correction contains unreferenced compensating Effect',
  'Correction physical Effect incomplete',
  'Correction contains unrelated physical lines',
  'Correction unsealed item',
  'Correction idempotency resource incomplete',
  'Correction idempotency history immutable',
]);

// Verified against installed Prisma 6.19.3 engine c2990dca591cba766e3b7ef5d9e8a84796e47ab7:
// CoreError::ConnectorError -> ErrorKind::QueryError -> PostgresError::fmt.
// Each complete message is an exact map key; no substring/whitespace matching.
const PRISMA_CONNECTOR_PREFIX =
  'Error in connector: Error querying the database: ERROR: ';
const CORRECTION_PRISMA_MESSAGES = new Map<string, string>();
for (const diagnostic of CORRECTION_CHECK_DIAGNOSTICS) {
  CORRECTION_PRISMA_MESSAGES.set(diagnostic, diagnostic);
  CORRECTION_PRISMA_MESSAGES.set(
    PRISMA_CONNECTOR_PREFIX + diagnostic,
    diagnostic,
  );
}

type Failure = {
  kind:
    | 'duplicate'
    | 'foreign-key'
    | 'check'
    | 'lock-timeout'
    | 'statement-cancelled'
    | 'transaction-timeout'
    | 'pool-timeout'
    | 'deadlock'
    | 'transaction-conflict'
    | 'other';
  code: string | null;
  constraint: string | null;
  target: string[];
  detail: string;
  diagnostic: string | null;
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

// Preserve connector codes. In particular P2034 is ambiguous (serialization
// OR deadlock), never evidence of a duplicate or of a known 40P01 deadlock.
export function correctionPgFailure(error: unknown): Failure {
  const e = record(error),
    meta = record(e.meta),
    database = record(meta.database_error);
  const raw =
    typeof meta.database_error === 'string' ? meta.database_error : '';
  // COMMIT may be a Prisma UnknownRequestError without meta. Parse only the
  // connector's structured PostgresError envelope, never incidental SQLSTATE text.
  const connector =
    e.name === 'PrismaClientUnknownRequestError' &&
    typeof e.message === 'string' &&
    e.message.includes('ConnectorError')
      ? e.message
      : '';
  const postgres =
    /(?:PostgresError|DbError)\s*\{[^{}]*?\bcode:\s*(?:"([0-9A-Z]{5})"|SqlState\(E([0-9A-Z]{5})\)),\s*message:\s*("(?:[^"\\]|\\.)*")/.exec(
      raw || connector,
    );
  const sqlState =
    [e.code, meta.code, database.code].find(
      (value): value is string =>
        typeof value === 'string' &&
        /^[0-9A-Z]{5}$/.test(value) &&
        !value.startsWith('P'),
    ) ??
    /SqlState\(E([0-9A-Z]{5})\)/.exec(raw)?.[1] ??
    postgres?.[1] ??
    postgres?.[2];
  const envelopeCode = typeof e.code === 'string' ? e.code : null;
  const code =
    envelopeCode?.startsWith('P') && !['P2004', 'P2010'].includes(envelopeCode)
      ? envelopeCode
      : (sqlState ?? envelopeCode);
  const constraint =
    typeof meta.constraint === 'string'
      ? meta.constraint
      : typeof database.constraint === 'string'
        ? database.constraint
        : (/constraint: Some\("([^"]+)"\)/.exec(raw || connector)?.[1] ?? null);
  const target = Array.isArray(meta.target)
    ? meta.target.filter((v): v is string => typeof v === 'string')
    : [];
  const kinds: Record<string, Failure['kind']> = {
    '23505': 'duplicate',
    P2002: 'duplicate',
    '23503': 'foreign-key',
    P2003: 'foreign-key',
    '23514': 'check',
    '55P03': 'lock-timeout',
    '57014': 'statement-cancelled',
    P2028: 'transaction-timeout',
    P2024: 'pool-timeout',
    '40P01': 'deadlock',
    P2034: 'transaction-conflict',
  };
  const detail = [meta.message, raw, e.message]
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
  let diagnostic: string | null = null;
  if (postgres) {
    try {
      diagnostic = JSON.parse(postgres[3]) as string;
    } catch {
      // Unrecognized connector serialization must fail closed.
    }
  } else {
    const message = [database.message, meta.message, raw].find(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
    if (message) {
      diagnostic = message.replace(/^(?:db error: )?ERROR:\s*/, '').trim();
    }
  }
  // Deferred COMMIT can return a genuine Prisma unknown request error with
  // only a diagnostic or the exact connector Display wrapper, without SQLSTATE.
  // Do not trust a name-only imitation, partial message, or conflicting metadata.
  const prismaDiagnostic =
    typeof e.message === 'string'
      ? (CORRECTION_PRISMA_MESSAGES.get(e.message) ?? null)
      : null;
  const diagnosticOnlyPrismaCheck =
    code === null &&
    e.code == null &&
    meta.code == null &&
    database.code == null &&
    !raw &&
    diagnostic === null &&
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    e.name === 'PrismaClientUnknownRequestError' &&
    prismaDiagnostic !== null;
  if (diagnosticOnlyPrismaCheck) diagnostic = prismaDiagnostic;
  return {
    kind: diagnosticOnlyPrismaCheck
      ? 'check'
      : code
        ? (kinds[code] ?? 'other')
        : 'other',
    code,
    constraint,
    target,
    detail,
    diagnostic,
  };
}

export type CorrectionCheckExpectation = {
  messages: readonly string[];
  constraint?: string;
};

// Each negative test names the precise validator it intends to reach. A random
// CHECK (including one caused by an invalid fixture) is not a successful test.
export function isCorrectionCheckViolation(
  error: unknown,
  expected: CorrectionCheckExpectation,
): boolean {
  const failure = correctionPgFailure(error);
  if (
    failure.code !== '23514' &&
    failure.code !== 'P2004' &&
    !(failure.code === null && failure.kind === 'check')
  )
    return false;
  if (
    expected.constraint &&
    failure.constraint &&
    failure.constraint !== expected.constraint
  )
    return false;
  return (
    (failure.code === '23514' &&
      !!expected.constraint &&
      failure.constraint === expected.constraint) ||
    (failure.diagnostic !== null &&
      expected.messages.includes(failure.diagnostic))
  );
}

export function isDispatchCorrectionDuplicate(error: unknown): boolean {
  const failure = correctionPgFailure(error);
  return (
    failure.kind === 'duplicate' &&
    (failure.constraint === 'DispatchCorrection_dispatch_key' ||
      (failure.target.length === 2 &&
        failure.target.includes('companyId') &&
        failure.target.includes('dispatchId')))
  );
}

export type CorrectionRejectionExpectation =
  | ({ kind: 'check' } & CorrectionCheckExpectation)
  | {
      kind: 'check' | 'foreign-key' | 'duplicate';
      constraint: string;
      target?: readonly string[];
    };

export function isCorrectionRejection(
  error: unknown,
  expected: CorrectionRejectionExpectation,
): boolean {
  if ('messages' in expected)
    return isCorrectionCheckViolation(error, expected);
  const failure = correctionPgFailure(error);
  if (
    expected.kind === 'check'
      ? failure.code !== '23514' && failure.code !== 'P2004'
      : failure.kind !== expected.kind
  )
    return false;
  const quotedConstraint =
    /violates (?:check|foreign key|unique) constraint "([^"]+)"/.exec(
      failure.detail,
    )?.[1];
  // Prisma's structured connector message escapes identifier quotes in detail.
  // diagnostic has already been decoded; use its complete CHECK identifier only
  // for genuine Prisma errors, retaining the SQLSTATE gate above.
  const decodedConstraint =
    expected.kind === 'check' &&
    (error instanceof Prisma.PrismaClientUnknownRequestError ||
      error instanceof Prisma.PrismaClientKnownRequestError)
      ? /violates check constraint "([^"]+)"/.exec(
          failure.diagnostic ?? '',
        )?.[1]
      : undefined;
  const meta = record(record(error).meta);
  const database = record(meta.database_error);
  const fieldName =
    failure.code === 'P2003' && typeof meta.field_name === 'string'
      ? meta.field_name
      : null;
  const fieldMatches =
    fieldName === expected.constraint ||
    fieldName === `${expected.constraint} (index)`;
  if (
    (failure.constraint && failure.constraint !== expected.constraint) ||
    (typeof database.constraint === 'string' &&
      database.constraint !== expected.constraint) ||
    (quotedConstraint && quotedConstraint !== expected.constraint) ||
    (decodedConstraint && decodedConstraint !== expected.constraint) ||
    (fieldName && !fieldMatches)
  )
    return false;
  const targetMatches =
    expected.target !== undefined &&
    failure.target.length === expected.target.length &&
    expected.target.every((field) => failure.target.includes(field));
  if (expected.target && failure.target.length && !targetMatches) return false;
  return (
    failure.constraint === expected.constraint ||
    quotedConstraint === expected.constraint ||
    decodedConstraint === expected.constraint ||
    fieldMatches ||
    (failure.kind === 'duplicate' && targetMatches)
  );
}

// A resolved promise, transport failure, or wrong validator is always a failure.
// No Jest globals: the same assertion is exercised by offline unit tests.
export async function assertCorrectionRejection(
  promise: Promise<unknown>,
  expected: CorrectionRejectionExpectation,
) {
  const result = await promise.then(
    () => ({ accepted: true, error: null as unknown }),
    (error: unknown) => ({ accepted: false, error }),
  );
  if (result.accepted) throw new Error('Expected correction rejection');
  const failure = correctionPgFailure(result.error);
  if (!isCorrectionRejection(result.error, expected))
    throw new Error(`Unexpected correction rejection: ${failure.kind}`);
  return failure;
}

export function correctionBarrier() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

export async function correctionDeadline<T>(
  promise: Promise<T>,
  milliseconds: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error('Correction QA synchronization deadline exceeded'),
            ),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
