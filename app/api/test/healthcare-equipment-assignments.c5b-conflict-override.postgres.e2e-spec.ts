// describe.skip evaluates its callback: runtime imports stay inside the test.
const c5bOverrideEnabled = process.env.RUN_HC_C5B_POSTGRES_TESTS === '1';

(c5bOverrideEnabled ? describe : describe.skip)(
  'HC-NEXT-03C5-B3 persisted Create ConflictOverride',
  () => {
    it('revalidates stale review, rolls back an INJECTED failure and persists/replays confirmed audit', async () => {
      const { withC5bHarness } =
        await import('./helpers/healthcare-c5b-harness');
      const { randomUUID, createHash } = await import('node:crypto');
      const { JwtService } = await import('@nestjs/jwt');
      const { Prisma } = await import('@prisma/client');
      const { default: supertest } = await import('supertest');
      const { HealthcareEquipmentAssignmentsRepository } =
        await import('../src/healthcare/equipment-assignments/healthcare-equipment-assignments.repository');

      await withC5bHarness(async (context) => {
        const { prisma, app, owners, token, checkBoundary } = context;
        const [a, b] = owners;
        const where = { companyId: { in: owners.map((owner) => owner.id) } };
        const fixed = new Date('2026-10-01T00:00:00.000Z');
        const route = '/healthcare/equipment-assignments';
        const scope = 'HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE' as const;
        type Owner = (typeof owners)[number];
        type Input = {
          caseId: string;
          equipmentAssetId: string;
          directAssignmentReason: string;
          confirmConflictOverride?: boolean;
          conflictReviewFingerprint?: string;
          conflictOverrideReason?: string;
        };
        const product = (owner: Owner) =>
          prisma.product.create({
            data: {
              companyId: owner.id,
              sku: `C5B3-${randomUUID()}`,
              name: 'B3 equipment',
              inventoryTracking: 'ASSET',
              stock: 7,
              createdAt: fixed,
              updatedAt: fixed,
            },
          });
        const asset = (owner: Owner, productId: string) =>
          prisma.equipmentAsset.create({
            data: {
              companyId: owner.id,
              productId,
              assetCode: `C5B3-${randomUUID()}`,
              lifecycle: 'ACTIVE',
              condition: 'GOOD',
              createdAt: fixed,
              updatedAt: fixed,
            },
          });
        const healthcareCase = (owner: Owner, day: string) =>
          prisma.healthcareCase.create({
            data: {
              companyId: owner.id,
              folio: `C5B3-${randomUUID()}`,
              title: 'B3 Case',
              createdById: owner.userId,
              status: 'DRAFT',
              scheduledStart: new Date(`${day}T12:00:00.000Z`),
              scheduledEnd: new Date(`${day}T13:00:00.000Z`),
              createdAt: fixed,
              updatedAt: fixed,
            },
          });
        await checkBoundary();
        const pa = await product(a);
        const pb = await product(b);
        const xa = await asset(a, pa.id);
        const xb = await asset(b, pb.id);
        const candidate = await healthcareCase(a, '2026-11-01');
        const case1 = await healthcareCase(a, '2026-11-01');
        const case2 = await healthcareCase(a, '2026-11-03');
        await healthcareCase(b, '2026-11-01');
        const existing: Array<{ id: string; caseId: string }> = [];
        for (const healthcareCase of [case1, case2]) {
          existing.push(
            await prisma.healthcareEquipmentAssignment.create({
              data: {
                companyId: a.id,
                caseId: healthcareCase.id,
                equipmentAssetId: xa.id,
                origin: 'DIRECT',
                lifecycle: 'RESERVED',
                directAssignmentReason: 'B3 existing reservation',
                createdById: a.userId,
                createdAt: fixed,
                updatedAt: fixed,
              },
            }),
          );
        }
        const sales = await prisma.user.create({
          data: {
            companyId: a.id,
            email: `c5b3-${randomUUID()}@example.invalid`,
            firstName: 'B3',
            lastName: 'SALES',
            role: 'SALES',
            isActive: true,
            authVersion: 0,
            passwordHash: 'not-a-login-credential',
            createdAt: fixed,
            updatedAt: fixed,
          },
        });
        const salesToken = app.get(JwtService).sign({
          sub: sales.id,
          companyId: a.id,
          email: sales.email,
          role: sales.role,
          authVersion: sales.authVersion,
        });
        const actor = await prisma.user.findUniqueOrThrow({
          where: { id: a.userId },
          select: { id: true, firstName: true, lastName: true },
        });
        await checkBoundary();

        // Only B0-authorized resources are read. Other domains remain ACL-prohibited.
        const snapshot = async () => ({
          products: await prisma.product.findMany({
            where,
            orderBy: { id: 'asc' },
          }),
          assets: await prisma.equipmentAsset.findMany({
            where,
            orderBy: { id: 'asc' },
          }),
          cases: await prisma.healthcareCase.findMany({
            where,
            orderBy: { id: 'asc' },
          }),
          requirements: await prisma.healthcareCaseRequirement.findMany({
            where,
            orderBy: { id: 'asc' },
          }),
          settings: await prisma.healthcareEquipmentAssignmentSettings.findMany(
            { where, orderBy: { companyId: 'asc' } },
          ),
          assignments: await prisma.healthcareEquipmentAssignment.findMany({
            where,
            orderBy: { id: 'asc' },
          }),
          overrides:
            await prisma.healthcareEquipmentAssignmentConflictOverride.findMany(
              { where, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
            ),
          claims: await prisma.idempotencyRecord.findMany({
            where,
            orderBy: { id: 'asc' },
          }),
        });
        const initial = await snapshot();
        expect(initial.assignments).toHaveLength(2);
        expect(initial.claims).toEqual([]);
        expect(initial.overrides).toEqual([]);
        expect(initial.requirements).toEqual([]);
        expect(initial.settings).toEqual([]);
        const post = async (
          input: Input,
          key: string,
          bearer: string | undefined,
          status: number,
        ): Promise<unknown> => {
          let request = supertest(app.getHttpServer())
            .post(route)
            .set('Idempotency-Key', key)
            .send(input);
          if (bearer !== undefined)
            request = request.auth(bearer, { type: 'bearer' });
          const response = await request.timeout({
            response: 10000,
            deadline: 15000,
          });
          expect(response.status).toBe(status);
          return response.body as unknown;
        };
        const noWrite = async (
          input: Input,
          status: number,
          bearer: string | undefined = token,
          key = randomUUID(),
        ) => {
          const before = await snapshot();
          const body = await post(input, key, bearer, status);
          expect(await snapshot()).toEqual(before);
          return body;
        };
        const publicAsset = {
          id: xa.id,
          productId: pa.id,
          assetCode: xa.assetCode,
          serialNumber: null,
          lifecycle: 'ACTIVE',
          condition: 'GOOD',
          product: { id: pa.id, sku: pa.sku, name: pa.name, isActive: true },
        };
        const warning = {
          code: 'CURRENT_ASSIGNMENT_CONFLICT',
          message:
            'El equipo tiene otra reserva activa con horario superpuesto',
        };
        const availability = {
          fullyVerifiable: true,
          conflictFree: false,
          warnings: [warning],
        };
        const window = {
          start: '2026-11-01T10:00:00.000Z',
          end: '2026-11-01T16:00:00.000Z',
        };
        const base: Input = {
          caseId: candidate.id,
          equipmentAssetId: xa.id,
          directAssignmentReason: '  B3 direct assignment  ',
        };
        const assertReview = (body: unknown, count: number): string => {
          const conflicts = existing.slice(0, count).map((row, index) => ({
            assignmentId: row.id,
            caseId: row.caseId,
            caseFolio: [case1, case2][index].folio,
            windowStart: window.start,
            windowEnd: window.end,
          }));
          expect(body).toEqual({
            outcome: 'CONFLICT_REVIEW_REQUIRED',
            conflictReviewFingerprint: expect.stringMatching(
              /^[a-f0-9]{64}$/,
            ) as unknown,
            overrideRequired: true,
            conflicts: expect.arrayContaining(conflicts) as unknown,
            candidate: {
              caseId: candidate.id,
              requirementId: null,
              origin: 'DIRECT',
              equipmentAsset: publicAsset,
              operationalWindow: window,
            },
            unresolvedReservations: [],
            availability,
          });
          const review = body as {
            conflictReviewFingerprint: string;
            conflicts: unknown[];
          };
          expect(review.conflicts).toHaveLength(count);
          return review.conflictReviewFingerprint;
        };
        const f1 = assertReview(await noWrite(base, 200), 1);
        await checkBoundary();
        const confirmation: Input = {
          ...base,
          confirmConflictOverride: true,
          conflictReviewFingerprint: f1,
          conflictOverrideReason: '  B3 accepted conflict  ',
        };
        // Pass no bearer directly: the convenience helper's default is ADMIN.
        const beforeAuth = await snapshot();
        expect(await post(confirmation, randomUUID(), undefined, 401)).toEqual({
          statusCode: 401,
          message: 'Unauthorized',
        });
        expect(await snapshot()).toEqual(beforeAuth);
        expect(await noWrite(confirmation, 403, salesToken)).toEqual({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        });
        for (const input of [
          { ...confirmation, conflictReviewFingerprint: undefined },
          { ...confirmation, conflictOverrideReason: undefined },
          { ...confirmation, confirmConflictOverride: undefined },
          { ...confirmation, conflictReviewFingerprint: 'not-a-fingerprint' },
          { ...confirmation, conflictOverrideReason: ' '.repeat(3) },
          { ...confirmation, conflictOverrideReason: 'x'.repeat(1001) },
        ])
          await noWrite(input, 400);
        const foreign = await noWrite(
          { ...confirmation, equipmentAssetId: xb.id },
          404,
        );
        expect(foreign).toEqual({
          statusCode: 404,
          error: 'Not Found',
          code: 'EQUIPMENT_ASSET_NOT_FOUND',
          message: 'Equipo no encontrado',
        });
        expect(
          await noWrite(
            { ...confirmation, equipmentAssetId: randomUUID() },
            404,
          ),
        ).toEqual(foreign);

        const schedule = {
          scheduledStart: candidate.scheduledStart,
          scheduledEnd: candidate.scheduledEnd,
          updatedAt: new Date('2026-10-02T00:00:00.000Z'),
        };
        await prisma.healthcareCase.update({
          where: { id: case2.id, companyId: a.id },
          data: schedule,
        });
        const staleState = await snapshot();
        expect(staleState).toEqual({
          ...initial,
          cases: initial.cases.map((row) =>
            row.id === case2.id ? { ...row, ...schedule } : row,
          ),
        });
        const f2 = assertReview(await noWrite(confirmation, 200), 2);
        expect(f2).not.toBe(f1);
        await checkBoundary();

        const confirmed: Input = {
          ...confirmation,
          conflictReviewFingerprint: f2,
        };
        const key = randomUUID();
        const repository = app.get(HealthcareEquipmentAssignmentsRepository);
        const completionTarget: {
          completeIdempotencyClaim: (
            ...args: Parameters<typeof repository.completeIdempotencyClaim>
          ) => Promise<{ id: string }>;
        } = repository;
        let observedPendingWrites = false;
        const completion = jest
          .spyOn(completionTarget, 'completeIdempotencyClaim')
          .mockImplementationOnce(async (transaction, claimId, resourceId) => {
            // INJECTED FAILURE after real inserts in the real PostgreSQL transaction.
            expect(
              await transaction.healthcareEquipmentAssignment.findUniqueOrThrow(
                { where: { id: resourceId } },
              ),
            ).toMatchObject({
              companyId: a.id,
              caseId: candidate.id,
              equipmentAssetId: xa.id,
              createdById: a.userId,
            });
            const overrides =
              await transaction.healthcareEquipmentAssignmentConflictOverride.findMany(
                { where: { companyId: a.id, assignmentId: resourceId } },
              );
            expect(overrides).toHaveLength(2);
            expect(
              overrides.map((row) => row.conflictingAssignmentId).sort(),
            ).toEqual(existing.map((row) => row.id).sort());
            expect(
              await transaction.idempotencyRecord.findUniqueOrThrow({
                where: { id: claimId },
              }),
            ).toMatchObject({ companyId: a.id, scope, key, resourceId: null });
            observedPendingWrites = true;
            throw new Prisma.PrismaClientKnownRequestError(
              'B3 INJECTED completion failure',
              { code: 'P2025', clientVersion: Prisma.prismaVersion.client },
            );
          });
        try {
          expect(await noWrite(confirmed, 500, token, key)).toEqual({
            statusCode: 500,
            error: 'Internal Server Error',
            code: 'HEALTHCARE_PERSISTENCE_ERROR',
            message: 'No fue posible completar la operación',
          });
          expect(completion).toHaveBeenCalledTimes(1);
          expect(observedPendingWrites).toBe(true);
        } finally {
          completion.mockRestore();
        }
        expect(await snapshot()).toEqual(staleState);
        await checkBoundary();

        const body = await post(confirmed, key, token, 201);
        const persisted = await snapshot();
        expect(persisted.assignments).toHaveLength(3);
        const row = persisted.assignments.find(
          (assignment) => assignment.caseId === candidate.id,
        )!;
        expect(row).toEqual({
          id: expect.any(String) as unknown,
          companyId: a.id,
          caseId: candidate.id,
          equipmentAssetId: xa.id,
          requirementId: null,
          origin: 'DIRECT',
          lifecycle: 'RESERVED',
          replacesAssignmentId: null,
          directAssignmentReason: 'B3 direct assignment',
          createdById: a.userId,
          releasedAt: null,
          releasedById: null,
          releaseCause: null,
          releaseReason: null,
          replacedAt: null,
          replacedById: null,
          replacementReason: null,
          createdAt: expect.any(Date) as unknown,
          updatedAt: expect.any(Date) as unknown,
        });
        expect(persisted.overrides).toHaveLength(2);
        expect(
          persisted.overrides
            .map((override) => override.conflictingAssignmentId)
            .sort(),
        ).toEqual(existing.map((assignment) => assignment.id).sort());
        for (const override of persisted.overrides) {
          expect(override).toEqual({
            id: expect.any(String) as unknown,
            companyId: a.id,
            assignmentId: row.id,
            conflictingAssignmentId: override.conflictingAssignmentId,
            assignmentWindowStart: new Date(window.start),
            assignmentWindowEnd: new Date(window.end),
            conflictingWindowStart: new Date(window.start),
            conflictingWindowEnd: new Date(window.end),
            approvedById: a.userId,
            reason: 'B3 accepted conflict',
            createdAt: expect.any(Date) as unknown,
          });
          expect(Number.isFinite(override.createdAt.getTime())).toBe(true);
        }
        expect(persisted.claims).toHaveLength(1);
        expect(persisted.claims[0]).toMatchObject({
          companyId: a.id,
          scope,
          key,
          resourceId: row.id,
          requestHash: createHash('sha256')
            .update(
              JSON.stringify({
                caseId: candidate.id,
                equipmentAssetId: xa.id,
                requirementId: null,
                directAssignmentReason: 'B3 direct assignment',
                confirmConflictOverride: true,
                conflictReviewFingerprint: f2,
                conflictOverrideReason: 'B3 accepted conflict',
              }),
            )
            .digest('hex'),
        });
        expect(persisted).toEqual({
          ...staleState,
          assignments: [...staleState.assignments, row].sort((left, right) =>
            left.id.localeCompare(right.id),
          ),
          overrides: persisted.overrides,
          claims: persisted.claims,
        });
        const publicAssignment = {
          id: row.id,
          caseId: candidate.id,
          requirementId: null,
          origin: 'DIRECT',
          status: 'RESERVED',
          equipmentAsset: publicAsset,
          assignedAt: row.createdAt.toISOString(),
          assignedBy: actor,
          directAssignmentReason: 'B3 direct assignment',
          replacesAssignmentId: null,
          replacement: null,
          release: null,
          availability: {
            ...availability,
            warnings: [
              warning,
              {
                code: 'CONFLICT_OVERRIDE_CONFIRMED',
                message: 'El conflicto actual fue confirmado explícitamente',
              },
            ],
          },
          conflictOverrides: persisted.overrides.map((override) => ({
            conflictingAssignmentId: override.conflictingAssignmentId,
            approvedAt: override.createdAt.toISOString(),
            approvedBy: actor,
            reason: 'B3 accepted conflict',
          })),
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        };
        expect(body).toEqual({ outcome: 'CREATED', data: publicAssignment });
        expect(await noWrite(confirmed, 201, token, key)).toEqual(body);
        expect(
          await noWrite(
            {
              ...confirmed,
              conflictOverrideReason: 'B3 accepted conflict',
              directAssignmentReason: 'B3 direct assignment',
            },
            201,
            token,
            key,
          ),
        ).toEqual(body);
        expect(
          await noWrite(
            {
              ...confirmed,
              conflictOverrideReason: 'Different accepted reason',
            },
            409,
            token,
            key,
          ),
        ).toEqual({
          statusCode: 409,
          error: 'Conflict',
          code: 'IDEMPOTENCY_KEY_REUSED',
          message:
            'La clave de idempotencia ya fue utilizada con una solicitud diferente',
        });
        await checkBoundary();
        const detail = await supertest(app.getHttpServer())
          .get(`${route}/${row.id}`)
          .auth(token, { type: 'bearer' })
          .timeout({ response: 10000, deadline: 15000 });
        expect(detail.status).toBe(200);
        expect(detail.body as unknown).toEqual(publicAssignment);
        const list = await supertest(app.getHttpServer())
          .get(route)
          .query({ caseId: candidate.id })
          .auth(token, { type: 'bearer' })
          .timeout({ response: 10000, deadline: 15000 });
        expect(list.status).toBe(200);
        expect(list.body as unknown).toEqual({
          items: [publicAssignment],
          pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
        });
        expect(await snapshot()).toEqual(persisted);
        await checkBoundary();
        // B0 closes HTTP, restores JWT, accredits owners, deletes Overrides first,
        // checks all owned residue independently, then disconnects its sole client.
      });
    }, 120_000);
  },
);
