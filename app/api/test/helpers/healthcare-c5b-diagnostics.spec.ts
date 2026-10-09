import { inspect } from 'node:util';
import { Prisma } from '@prisma/client';
import { formatResultsErrors } from 'jest-message-util';
import {
  c5bConnectionUrl,
  c5bDiagnostic,
  c5bFailure,
  c5bRejectUnexpectedSessions,
  c5bAssertSessionIdentity,
  withC5bHarness,
} from './healthcare-c5b-harness';
import { PrismaService } from '../../src/prisma/prisma.service';

const teardown = {
  'app.close': 'PASS',
  cleanup: 'PASS',
  'cleanup.zero-residue': 'PASS',
  'prisma.disconnect': 'PASS',
} as const;

function jestFailure(error: Error): string {
  return (
    formatResultsErrors(
      [
        {
          ancestorTitles: ['C5B'],
          title: 'synthetic failure',
          fullName: 'C5B synthetic failure',
          status: 'failed',
          failureMessages: [error.stack ?? error.message],
          failureDetails: [error],
          numPassingAsserts: 0,
        },
      ],
      { rootDir: process.cwd(), testMatch: [] },
      { noStackTrace: true, noCodeFrame: true },
    ) ?? ''
  );
}

describe('C5B safe diagnostics (no database)', () => {
  const session = {
    pid: 123,
    role: 'zaping_hc_c5b',
    backendType: 'client backend',
    state: 'active',
    backendStart: new Date('2026-10-08T12:00:00.000Z'),
  };
  const sessionReport = (
    rows: Parameters<typeof c5bRejectUnexpectedSessions>[0],
  ) => {
    let failure: unknown;
    try {
      c5bRejectUnexpectedSessions(rows);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    return c5bFailure([c5bDiagnostic(failure, 'HTTP boundary')], teardown);
  };

  it('accepts an unchanged accredited identity with no rows from the conflict predicate', () => {
    const identity = {
      database: 'zaping_spike_test',
      user: 'zaping_hc_c5b',
      sessionUser: 'zaping_hc_c5b',
      schema: 'public',
      address: '172.17.0.2/32',
      port: 5432,
      version: '160015',
      pid: 123,
    };
    expect(() =>
      c5bAssertSessionIdentity({ ...identity }, identity),
    ).not.toThrow();
    expect(() => c5bRejectUnexpectedSessions([])).not.toThrow();
    expect(() =>
      c5bAssertSessionIdentity({ ...identity, pid: 456 }, identity),
    ).toThrow('backend identity changed');
  });

  it.each([
    [session, 'dedicated_role', 'client_backend', 'active'],
    [
      { ...session, role: 'some-other-role' },
      'other_role',
      'client_backend',
      'active',
    ],
    [{ ...session, state: 'idle' }, 'dedicated_role', 'client_backend', 'idle'],
    [
      { ...session, state: 'idle in transaction' },
      'dedicated_role',
      'client_backend',
      'idle_in_transaction',
    ],
    [
      { ...session, backendType: 'autovacuum worker' },
      'dedicated_role',
      'postgres_internal',
      'active',
    ],
    [
      { ...session, backendType: 'standalone backend', state: 'disabled' },
      'dedicated_role',
      'other_known',
      'other_known',
    ],
    [
      {
        pid: null,
        role: null,
        backendType: null,
        state: null,
        backendStart: null,
      },
      'unavailable',
      'unavailable',
      'unavailable',
    ],
  ])(
    'rejects unexpected metadata %j without granting trust',
    (row, role, backendType, state) => {
      const report = sessionReport([row]);
      expect(report.message).toContain(
        '[http.sessions] HarnessCheck: C5B target has unowned or unknown sessions',
      );
      expect(report.message).toContain('"pidClassification":"unexpected"');
      expect(report.message).toContain(`"role":"${role}"`);
      expect(report.message).toContain(`"backendType":"${backendType}"`);
      expect(report.message).toContain(`"state":"${state}"`);
      expect(report.message).toContain(
        `"backendStart":"${row.backendStart?.toISOString() ?? 'unavailable'}"`,
      );
      expect(jestFailure(report)).toContain('Session metadata:');
    },
  );

  it('redacts arbitrary session metadata in AggregateError, inspect and Jest output', () => {
    const secrets = [
      'postgresql://user:password-marker@host/db',
      'password-marker',
      'eyJhbGciOiJIUzI1NiJ9.jwt-marker.signature',
      'SELECT secret_marker',
      'arbitrary-application-marker',
    ];
    const raw = secrets.join(' ');
    const report = sessionReport([
      {
        pid: raw,
        role: raw,
        backendType: raw,
        state: raw,
        backendStart: raw,
        query: raw,
        application_name: raw,
      } as Parameters<typeof c5bRejectUnexpectedSessions>[0][number],
      { ...session, backendStart: new Date(NaN) },
    ]);
    const rendered = [
      report.message,
      report.stack,
      inspect(report, { depth: 10 }),
      jestFailure(report),
    ].join('\n');
    for (const secret of secrets) expect(rendered).not.toContain(secret);
    expect(rendered).toContain('"pid":"unavailable"');
    expect(rendered).toContain('"backendStart":"unavailable"');
    expect(rendered).toContain('"backendType":"unavailable"');
  });

  it('returns before connection or callback when explicitly disabled', async () => {
    const hadOptIn = Object.hasOwn(process.env, 'RUN_HC_C5B_POSTGRES_TESTS');
    const oldOptIn = process.env.RUN_HC_C5B_POSTGRES_TESTS;
    const connect = jest
      .spyOn(PrismaService.prototype, '$connect')
      .mockRejectedValue(new Error('Unexpected connection'));
    const operation = jest.fn<Promise<void>, []>();
    try {
      process.env.RUN_HC_C5B_POSTGRES_TESTS = '0';
      await withC5bHarness(operation);
      expect(operation).not.toHaveBeenCalled();
      expect(connect).not.toHaveBeenCalled();
    } finally {
      connect.mockRestore();
      if (hadOptIn) process.env.RUN_HC_C5B_POSTGRES_TESTS = oldOptIn;
      else delete process.env.RUN_HC_C5B_POSTGRES_TESTS;
    }
  });

  it('reproduces Jest hiding nested errors and renders the new outer summary', () => {
    const safe = c5bDiagnostic(
      new Prisma.PrismaClientInitializationError(
        'synthetic connection detail',
        'test',
        'P1000',
      ),
      'connect',
    );
    expect(
      jestFailure(new AggregateError([safe], 'generic failure')),
    ).not.toContain('P1000');
    const report = c5bFailure([safe], teardown);
    expect(report).toBeInstanceOf(AggregateError);
    expect(report.errors).toHaveLength(1);
    expect(jestFailure(report)).toContain(
      '[connection.authentication] PrismaClientInitializationError P1000',
    );
    expect(jestFailure(report)).toContain('[cleanup] PASS');
  });

  it('shows primary, cleanup, residue, close and disconnect failures together', () => {
    const stages = [
      'schema',
      'cleanup Company',
      'residue Company',
      'app close',
      'disconnect',
    ];
    const report = c5bFailure(
      stages.map((name) => c5bDiagnostic(new Error('raw'), name)),
      {
        'app.close': 'FAIL',
        cleanup: 'FAIL',
        'cleanup.zero-residue': 'FAIL',
        'prisma.disconnect': 'FAIL',
      },
    );
    const rendered = jestFailure(report);
    for (const label of [
      'preflight.schema',
      'cleanup.Company',
      'cleanup.zero-residue.Company',
      'app.close',
      'prisma.disconnect',
    ]) {
      expect(rendered).toContain(`[${label}] Error: operation failed`);
    }
    expect(report.errors).toHaveLength(5);
    expect(report.message).toBe(
      c5bFailure(
        stages.map((name) => c5bDiagnostic(new Error('different raw'), name)),
        {
          'app.close': 'FAIL',
          cleanup: 'FAIL',
          'cleanup.zero-residue': 'FAIL',
          'prisma.disconnect': 'FAIL',
        },
      ).message,
    );
  });

  it('excludes raw messages, names, stack, causes, URLs, tokens and metadata', () => {
    const secrets = [
      'password-marker',
      'jwt-secret-marker',
      'bearer-token-marker',
      'postgresql://sensitive-host/db',
      'SELECT sensitive_sql_marker',
    ];
    const raw = new Prisma.PrismaClientKnownRequestError(secrets.join(' '), {
      code: 'P2010',
      clientVersion: secrets[0],
      meta: { code: '42501', detail: secrets },
    });
    raw.name = secrets[1];
    raw.stack = secrets[2];
    raw.cause = new Error(secrets[3]);
    const report = c5bFailure(
      [
        c5bDiagnostic(raw, 'functions'),
        new Error(secrets.join(' ')),
        {
          name: secrets[0],
          message: secrets[1],
          code: secrets[2],
          meta: secrets,
        },
      ],
      teardown,
    );
    const rendered = [
      report.message,
      report.stack,
      inspect(report, { depth: 10 }),
      jestFailure(report),
    ].join('\n');
    for (const secret of secrets) expect(rendered).not.toContain(secret);
    expect(rendered).toContain('PrismaClientKnownRequestError P2010/42501');
  });

  it('rejects arbitrary code and stage strings, without copying a raw error name', () => {
    const raw = new Prisma.PrismaClientKnownRequestError('hidden-message', {
      code: 'hidden-code',
      clientVersion: 'test',
      meta: { code: 'hidden-sqlstate' },
    });
    const rendered = c5bFailure(
      [c5bDiagnostic(raw, 'hidden-stage')],
      teardown,
    ).message;
    expect(rendered).not.toContain('hidden-');
    expect(rendered).toContain('[functional] PrismaClientKnownRequestError');
  });

  it('keeps the first stage when a safe error crosses the outer catch', () => {
    const original = c5bDiagnostic(new Error('raw'), 'ACL prohibited');
    expect(c5bDiagnostic(original, 'functional/setup')).toBe(original);
    expect(c5bFailure([original], teardown).message).toContain(
      '[preflight.acl.prohibited]',
    );
    expect(c5bDiagnostic(new Error('raw'), 'ACL positive').message).toContain(
      '[preflight.acl.positive]',
    );
  });

  it('distinguishes skipped cleanup from successful cleanup after failed setup', () => {
    const report = c5bFailure([new Error('raw')], {
      'app.close': 'SKIPPED_NO_APP',
      cleanup: 'SKIPPED_NO_FIXTURES',
      'cleanup.zero-residue': 'SKIPPED_NO_FIXTURES',
      'prisma.disconnect': 'PASS',
    });
    expect(jestFailure(report)).toContain('[cleanup] SKIPPED_NO_FIXTURES');
    expect(jestFailure(report)).toContain('[prisma.disconnect] PASS');
    expect(
      c5bFailure([new Error('raw')], {
        ...teardown,
        cleanup: 'SKIPPED_BOUNDARY',
      }).message,
    ).toContain('[cleanup] SKIPPED_BOUNDARY');
  });

  it('retains code-owned assertion detail without exposing the rejected URL', () => {
    let failure: unknown;
    try {
      c5bConnectionUrl('postgresql://sensitive:password-marker@wrong-host/db');
    } catch (error) {
      failure = error;
    }
    const diagnostic = c5bDiagnostic(failure, 'URL');
    expect(diagnostic.message).toBe(
      '[preflight.url-target] HarnessCheck: C5B invalid dedicated URL',
    );
  });
});
