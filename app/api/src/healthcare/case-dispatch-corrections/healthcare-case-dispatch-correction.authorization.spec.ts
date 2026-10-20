import { PrismaClient } from '@prisma/client';
import {
  CORRECTION_QA_MARKER,
  correctionQaUrl,
  verifyCorrectionQaDatabase,
} from '../../../test/helpers/dispatch-correction-postgres-authorization';

describe('correction PostgreSQL authorization preflight (mocked, no connection)', () => {
  const env = {
    HC_DSP_COR_01B_DATABASE_AUTHORIZATION: CORRECTION_QA_MARKER,
    CASE_DISPATCH_CORRECTION_TEST_RUN: 'unit-test',
    CASE_DISPATCH_CORRECTION_TEST_DATABASE_URL:
      'postgresql://hc_dsp_cor_01b_test:synthetic@127.0.0.1:5435/zaping_hc_dsp_cor_01b_test',
  };
  it('requires explicit ticket authorization, independently of DATABASE_URL', () => {
    expect(() =>
      correctionQaUrl({
        DATABASE_URL: env.CASE_DISPATCH_CORRECTION_TEST_DATABASE_URL,
      }),
    ).toThrow('not explicitly authorized');
    expect(correctionQaUrl(env)).toBe(
      env.CASE_DISPATCH_CORRECTION_TEST_DATABASE_URL,
    );
  });
  it.each([
    'postgresql://hc_dsp_cor_01b_test:synthetic@remote:5435/zaping_hc_dsp_cor_01b_test',
    'postgresql://hc_dsp_cor_01b_test:synthetic@127.0.0.1:5435/production',
    'postgresql://postgres:synthetic@127.0.0.1:5435/zaping_hc_dsp_cor_01b_test',
    env.CASE_DISPATCH_CORRECTION_TEST_DATABASE_URL + '?host=remote',
  ])('refuses unverified target %s', (url) => {
    expect(() =>
      correctionQaUrl({
        ...env,
        CASE_DISPATCH_CORRECTION_TEST_DATABASE_URL: url,
      }),
    ).toThrow('Unverified');
  });
  it.each(['5432', '5434', '55431', '6543', ''])(
    'refuses any port other than 5435 (%s)',
    (port) => {
      const url = new URL(env.CASE_DISPATCH_CORRECTION_TEST_DATABASE_URL);
      url.port = port;
      expect(() =>
        correctionQaUrl({
          ...env,
          CASE_DISPATCH_CORRECTION_TEST_DATABASE_URL: url.toString(),
        }),
      ).toThrow('Unverified');
    },
  );
  const identity = {
    database: 'zaping_hc_dsp_cor_01b_test',
    role: 'hc_dsp_cor_01b_test',
    owner: 'hc_dsp_cor_01b_test',
    version: 160015,
    marker: CORRECTION_QA_MARKER,
    rolsuper: false,
    rolcreatedb: false,
    rolcreaterole: false,
    rolreplication: false,
    rolbypassrls: false,
  };
  it.each([
    { database: 'production' },
    { role: 'postgres' },
    { owner: 'another-role' },
    { marker: null },
    { version: 150000 },
    { version: 170000 },
    { rolsuper: true },
    { rolcreatedb: true },
    { rolcreaterole: true },
    { rolreplication: true },
    { rolbypassrls: true },
  ])(
    'refuses identity/isolation mismatch %j before accessing fixtures',
    async (patch) => {
      const count = jest.fn();
      const db = {
        $queryRaw: jest.fn().mockResolvedValue([{ ...identity, ...patch }]),
        company: { count },
      } as unknown as PrismaClient;
      await expect(verifyCorrectionQaDatabase(db)).rejects.toThrow(
        'Unverified',
      );
      expect(count).not.toHaveBeenCalled();
    },
  );
  it('refuses foreign companies even with the correct database marker', async () => {
    const db = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([identity])
        .mockResolvedValueOnce([{ has_company: true }]),
      company: { count: jest.fn().mockResolvedValue(1) },
    } as unknown as PrismaClient;
    await expect(verifyCorrectionQaDatabase(db)).rejects.toThrow(
      'non-ticket companies',
    );
  });
  it('permits an authorized empty database preflight before schema migration', async () => {
    const count = jest.fn();
    const db = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([identity])
        .mockResolvedValueOnce([{ has_company: false }]),
      company: { count },
    } as unknown as PrismaClient;
    expect(await verifyCorrectionQaDatabase(db)).toMatchObject({
      database: identity.database,
      version: identity.version,
    });
    expect(count).not.toHaveBeenCalled();
  });
});
