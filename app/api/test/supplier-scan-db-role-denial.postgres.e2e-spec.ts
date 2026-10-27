import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';

/** B3d5b3c2a: disposable CI LOGIN roles, not SET ROLE or production grants. */
const describePg =
  process.env.RUN_SUPPLIER_SCAN_ROLE_DENIAL_PG === '1'
    ? describe
    : describe.skip;

const ACTORS = ['api', 'issuer', 'scanner', 'verifier', 'promoter'] as const;
type Actor = (typeof ACTORS)[number];

const PROTECTED_TABLES = [
  'SupplierAttachmentScanJob',
  'SupplierAttachmentScanAttempt',
  'SupplierAttachmentSignedEvidenceReceipt',
  'SupplierAttachmentVerifiedScanEvidence',
  'SupplierDocumentAttachment',
] as const;

type RoleRecord = {
  name: string;
  connection: PrismaClient;
};

describePg('B3d5b3c2a separate non-owner PostgreSQL login denials', () => {
  let owner: PrismaClient;
  const roles = new Map<Actor, RoleRecord>();
  const suffix = randomBytes(5).toString('hex');

  beforeAll(async () => {
    const raw = process.env.DATABASE_URL;
    if (
      !raw ||
      process.env.CI !== 'true' ||
      process.env.GITHUB_ACTIONS !== 'true'
    ) {
      throw new Error('Role matrix requires disposable GitHub Actions');
    }
    const target = new URL(raw);
    if (
      !['localhost', '127.0.0.1'].includes(target.hostname) ||
      target.port !== '5432' ||
      target.pathname !== '/zaping_test' ||
      target.username !== 'ci'
    ) {
      throw new Error('Unsafe target for PostgreSQL role matrix');
    }
    owner = new PrismaClient({ datasources: { db: { url: raw } } });
    const [identity] = await owner.$queryRawUnsafe<
      { database: string; role: string }[]
    >('SELECT current_database() AS database, current_user AS role');
    expect(identity).toEqual({ database: 'zaping_test', role: 'ci' });

    // Unprivileged, randomly passworded logins; neither credentials nor
    // service role definitions are stored in migrations or environment files.
    for (const actor of ACTORS) {
      const name = 'z_c2_' + actor + '_' + suffix;
      const password = randomBytes(24).toString('hex');
      await owner.$executeRawUnsafe(
        'CREATE ROLE "' +
          name +
          '" LOGIN NOINHERIT PASSWORD ' +
          "'" +
          password +
          "'",
      );
      const url = new URL(raw);
      url.username = name;
      url.password = password;
      roles.set(actor, {
        name,
        connection: new PrismaClient({
          datasources: { db: { url: url.toString() } },
        }),
      });
    }
  });

  afterAll(async () => {
    for (const role of roles.values()) {
      await role.connection.$disconnect();
    }
    if (owner) {
      for (const role of roles.values()) {
        await owner.$executeRawUnsafe('DROP ROLE "' + role.name + '"');
      }
      await owner.$disconnect();
    }
  });

  it.each(ACTORS)(
    '%s connects as a distinct non-owner LOGIN',
    async (actor) => {
      const role = roles.get(actor);
      if (!role) throw new Error('Role setup incomplete');
      const [session] = await role.connection.$queryRawUnsafe<
        { database: string; role: string; sessionRole: string }[]
      >(
        'SELECT current_database() AS database, current_user AS role, ' +
          'session_user AS "sessionRole"',
      );
      expect(session).toEqual({
        database: 'zaping_test',
        role: role.name,
        sessionRole: role.name,
      });
      const [attributes] = await owner.$queryRawUnsafe<
        {
          rolsuper: boolean;
          rolcreatedb: boolean;
          rolcreaterole: boolean;
          rolreplication: boolean;
          rolbypassrls: boolean;
          rolinherit: boolean;
        }[]
      >(
        'SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, ' +
          'rolbypassrls, rolinherit FROM pg_roles WHERE rolname = $1',
        role.name,
      );
      expect(attributes).toEqual({
        rolsuper: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolreplication: false,
        rolbypassrls: false,
        rolinherit: false,
      });
    },
  );

  it.each(ACTORS)(
    '%s has no direct protected-table privileges',
    async (actor) => {
      const role = roles.get(actor);
      if (!role) throw new Error('Role setup incomplete');
      for (const table of PROTECTED_TABLES) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
          const [rights] = await owner.$queryRawUnsafe<{ allowed: boolean }[]>(
            'SELECT has_table_privilege($1, $2, $3) AS allowed',
            role.name,
            '"' + table + '"',
            privilege,
          );
          expect(rights.allowed).toBe(false);
        }
      }
    },
  );

  it.each(ACTORS)(
    '%s cannot execute issue/consume functions',
    async (actor) => {
      const role = roles.get(actor);
      if (!role) throw new Error('Role setup incomplete');
      for (const routine of [
        '"issue_supplier_attachment_scan_job"(text,text,integer)',
        '"consume_supplier_attachment_scan_job"(text,uuid)',
      ]) {
        const [rights] = await owner.$queryRawUnsafe<{ allowed: boolean }[]>(
          'SELECT has_function_privilege($1, $2, $3) AS allowed',
          role.name,
          routine,
          'EXECUTE',
        );
        expect(rights.allowed).toBe(false);
      }
    },
  );

  it.each(ACTORS)('%s is denied actual DML forging attempts', async (actor) => {
    const role = roles.get(actor);
    if (!role) throw new Error('Role setup incomplete');
    const attacks = [
      'INSERT INTO "SupplierAttachmentVerifiedScanEvidence" DEFAULT VALUES',
      'INSERT INTO "SupplierAttachmentSignedEvidenceReceipt" DEFAULT VALUES',
      'INSERT INTO "SupplierAttachmentScanAttempt" DEFAULT VALUES',
      'UPDATE "SupplierDocumentAttachment" SET "status" = ' +
        "'AVAILABLE' WHERE FALSE",
      'UPDATE "SupplierAttachmentScanJob" SET "status" = ' +
        "'CONSUMED' WHERE FALSE",
    ];
    for (const sql of attacks) {
      await expect(role.connection.$executeRawUnsafe(sql)).rejects.toThrow(
        /permission denied/i,
      );
    }
  });

  it.each(ACTORS)('%s is denied actual SQL function calls', async (actor) => {
    const role = roles.get(actor);
    if (!role) throw new Error('Role setup incomplete');
    await expect(
      role.connection.$queryRawUnsafe(
        'SELECT * FROM "issue_supplier_attachment_scan_job"(' +
          "'no-company', 'no-reservation', 120)",
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      role.connection.$queryRawUnsafe(
        'SELECT "consume_supplier_attachment_scan_job"(' +
          "'no-company', '00000000-0000-4000-8000-000000000000'::uuid)",
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});
