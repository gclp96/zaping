// describe.skip evaluates its callback: keep all runtime imports/setup in the test.
const c5bCreateEnabled = process.env.RUN_HC_C5B_POSTGRES_TESTS === '1';

(c5bCreateEnabled ? describe : describe.skip)(
  'HC-NEXT-03C5-B2 Create HTTP/JWT acceptance',
  () => {
    it('accepts owned creates, isolates tenants and rolls back an INJECTED Prisma completion failure', async () => {
      const { withC5bHarness } =
        await import('./helpers/healthcare-c5b-harness');
      const { randomUUID, createHash } = await import('node:crypto');
      const { JwtService } = await import('@nestjs/jwt');
      const { Prisma, UserRole } = await import('@prisma/client');
      const { default: supertest } = await import('supertest');
      const { HealthcareEquipmentAssignmentsRepository } =
        await import('../src/healthcare/equipment-assignments/healthcare-equipment-assignments.repository');

      await withC5bHarness(async (context) => {
        const { prisma, app, owners, token, checkBoundary } = context;
        const [a, b] = owners;
        const where = { companyId: { in: owners.map((owner) => owner.id) } };
        const fixed = new Date('2026-10-01T00:00:00.000Z');
        const audit = new Date('2026-10-02T00:00:00.000Z');
        const route = '/healthcare/equipment-assignments';
        const scope = 'HEALTHCARE_EQUIPMENT_ASSIGNMENT_CREATE' as const;
        type Owner = (typeof owners)[number];
        type Input = {
          caseId: string;
          equipmentAssetId: string;
          requirementId?: string | null;
          directAssignmentReason?: string | null;
        };
        const available = {
          fullyVerifiable: true,
          conflictFree: true,
          warnings: [],
        };
        const incomplete = {
          fullyVerifiable: false,
          conflictFree: null,
          warnings: [
            {
              code: 'INCOMPLETE_CASE_SCHEDULE',
              message: 'La disponibilidad requiere revisar el horario del caso',
            },
          ],
        };
        const uncertain = {
          fullyVerifiable: false,
          conflictFree: null,
          warnings: [
            {
              code: 'RELATED_RESERVATION_SCHEDULE_INCOMPLETE',
              message:
                'Existe una reserva activa del mismo equipo con horario incompleto; la disponibilidad no puede verificarse completamente.',
            },
          ],
        };
        const conflicting = {
          fullyVerifiable: true,
          conflictFree: false,
          warnings: [
            {
              code: 'CURRENT_ASSIGNMENT_CONFLICT',
              message:
                'El equipo tiene otra reserva activa con horario superpuesto',
            },
          ],
        };

        const product = async (owner: Owner) => {
          const id = randomUUID();
          return prisma.product.create({
            data: {
              id,
              companyId: owner.id,
              sku: `C5B2-${id}`,
              name: 'B2 equipment',
              inventoryTracking: 'ASSET',
              stock: 7,
              createdAt: fixed,
              updatedAt: fixed,
            },
          });
        };
        const healthcareCase = async (
          owner: Owner,
          day: string | null,
          cancelled = false,
        ) => {
          const id = randomUUID();
          return prisma.healthcareCase.create({
            data: {
              id,
              companyId: owner.id,
              folio: `C5B2-${id}`,
              title: 'B2 Case',
              createdById: owner.userId,
              status: cancelled ? 'CANCELLED' : 'DRAFT',
              scheduledStart: day ? new Date(`${day}T12:00:00.000Z`) : null,
              scheduledEnd: day ? new Date(`${day}T13:00:00.000Z`) : null,
              cancelledAt: cancelled ? audit : null,
              cancelledById: cancelled ? owner.userId : null,
              cancellationReason: cancelled ? 'B2 cancelled fixture' : null,
              createdAt: fixed,
              updatedAt: cancelled ? audit : fixed,
            },
          });
        };
        const requirement = async (
          owner: Owner,
          caseId: string,
          productId: string,
          retired = false,
        ) =>
          prisma.healthcareCaseRequirement.create({
            data: {
              id: randomUUID(),
              companyId: owner.id,
              caseId,
              productId,
              requestedQty: 1,
              type: 'REQUIRED',
              sortOrder: 10,
              createdById: owner.userId,
              lifecycle: retired ? 'RETIRED' : 'ACTIVE',
              retiredAt: retired ? audit : null,
              retiredById: retired ? owner.userId : null,
              retirementReason: retired ? 'B2 retired fixture' : null,
              createdAt: fixed,
              updatedAt: retired ? audit : fixed,
            },
          });
        const asset = async (
          owner: Owner,
          productId: string,
          eligible = true,
        ) => {
          const id = randomUUID();
          return prisma.equipmentAsset.create({
            data: {
              id,
              companyId: owner.id,
              productId,
              assetCode: `C5B2-${id}`,
              condition: eligible ? 'GOOD' : 'DAMAGED',
              createdAt: fixed,
              updatedAt: fixed,
            },
          });
        };

        await checkBoundary();
        const p1 = await product(a);
        const p2 = await product(a);
        const pb = await product(b);
        const c1 = await healthcareCase(a, '2026-11-01');
        const c2 = await healthcareCase(a, '2026-11-01');
        const c3 = await healthcareCase(a, '2026-11-03');
        const ci = await healthcareCase(a, null);
        const cc = await healthcareCase(a, '2026-11-01', true);
        const cb = await healthcareCase(b, '2026-11-01');
        const r1 = await requirement(a, c1.id, p1.id);
        const r2 = await requirement(a, c2.id, p1.id);
        const retired = await requirement(a, c1.id, p2.id, true);
        const rb = await requirement(b, cb.id, pb.id);
        const x = await asset(a, p1.id);
        const y = await asset(a, p1.id);
        const z = await asset(a, p1.id, false);
        const w = await asset(a, p2.id);
        const xb = await asset(b, pb.id);
        const signActor = async (owner: Owner, id: string) => {
          const user = await prisma.user.findFirstOrThrow({
            where: { id, companyId: owner.id, isActive: true },
            select: {
              id: true,
              companyId: true,
              email: true,
              role: true,
              authVersion: true,
              firstName: true,
              lastName: true,
            },
          });
          return {
            companyId: owner.id,
            public: {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
            },
            token: app.get(JwtService).sign({
              sub: user.id,
              companyId: user.companyId,
              email: user.email,
              role: user.role,
              authVersion: user.authVersion,
            }),
          };
        };
        const admin = { ...(await signActor(a, a.userId)), token };
        const adminB = await signActor(b, b.userId);
        const extraActor = async (role: 'MANAGER' | 'WAREHOUSE' | 'SALES') => {
          const id = randomUUID();
          await prisma.user.create({
            data: {
              id,
              companyId: a.id,
              email: `c5b2-${id}@example.invalid`,
              firstName: 'B2',
              lastName: role,
              passwordHash: 'not-a-login-credential',
              role,
              authVersion: 0,
              isActive: true,
              createdAt: fixed,
              updatedAt: fixed,
            },
          });
          return signActor(a, id);
        };
        const manager = await extraActor(UserRole.MANAGER);
        const warehouse = await extraActor(UserRole.WAREHOUSE);
        const sales = await extraActor(UserRole.SALES);
        await checkBoundary();

        // Read only domains authorized by B0. Inventory/Purchases/Sales are not
        // queried: their write boundary relies on production behavior and ACL.
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
          assignments: await prisma.healthcareEquipmentAssignment.findMany({
            where,
            orderBy: { id: 'asc' },
          }),
          claims: await prisma.idempotencyRecord.findMany({
            where,
            orderBy: { id: 'asc' },
          }),
          overrides:
            await prisma.healthcareEquipmentAssignmentConflictOverride.findMany(
              { where, orderBy: { id: 'asc' } },
            ),
          settings: await prisma.healthcareEquipmentAssignmentSettings.findMany(
            { where, orderBy: { companyId: 'asc' } },
          ),
        });
        type State = Awaited<ReturnType<typeof snapshot>>;
        type Assignment = State['assignments'][number];
        const initial = await snapshot();
        expect(initial.assignments).toEqual([]);
        expect(initial.claims).toEqual([]);
        expect(initial.overrides).toEqual([]);
        expect(initial.settings).toEqual([]);
        const unchangedFixtures = (state: State) => {
          expect(state.products).toEqual(initial.products);
          expect(state.assets).toEqual(initial.assets);
          expect(state.cases).toEqual(initial.cases);
          expect(state.requirements).toEqual(initial.requirements);
          expect(state.overrides).toEqual([]);
          expect(state.settings).toEqual([]);
        };
        const post = async (
          input: Input,
          key: string | undefined,
          bearer: string | undefined,
          status: number,
        ): Promise<unknown> => {
          let request = supertest(app.getHttpServer()).post(route).send(input);
          if (key !== undefined) request = request.set('Idempotency-Key', key);
          if (bearer !== undefined)
            request = request.auth(bearer, { type: 'bearer' });
          const response = await request.timeout({
            response: 10000,
            deadline: 15000,
          });
          expect(response.status).toBe(status);
          return response.body as unknown;
        };
        const publicAsset = (equipmentAsset: typeof x, prod: typeof p1) => ({
          id: equipmentAsset.id,
          productId: prod.id,
          assetCode: equipmentAsset.assetCode,
          serialNumber: null,
          lifecycle: 'ACTIVE',
          condition: 'GOOD',
          product: {
            id: prod.id,
            sku: prod.sku,
            name: prod.name,
            isActive: true,
          },
        });
        const publicSuccess = (
          row: Assignment,
          actor: typeof admin,
          equipmentAsset: typeof x,
          prod: typeof p1,
          availability: unknown,
        ) => ({
          outcome: 'CREATED',
          data: {
            id: row.id,
            caseId: row.caseId,
            requirementId: row.requirementId,
            origin: row.origin,
            status: 'RESERVED',
            equipmentAsset: publicAsset(equipmentAsset, prod),
            assignedAt: row.createdAt.toISOString(),
            assignedBy: actor.public,
            ...(row.origin === 'DIRECT'
              ? { directAssignmentReason: row.directAssignmentReason }
              : {}),
            replacesAssignmentId: null,
            replacement: null,
            release: null,
            availability,
            conflictOverrides: [],
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          },
        });
        const requestHash = (input: Input) =>
          createHash('sha256')
            .update(
              JSON.stringify({
                caseId: input.caseId,
                equipmentAssetId: input.equipmentAssetId,
                requirementId: input.requirementId ?? null,
                directAssignmentReason:
                  input.directAssignmentReason?.trim() || null,
                confirmConflictOverride: false,
                conflictReviewFingerprint: null,
                conflictOverrideReason: null,
              }),
            )
            .digest('hex');
        const success = async (
          input: Input,
          key: string,
          actor: typeof admin,
          equipmentAsset: typeof x,
          prod: typeof p1,
          availability: unknown,
        ) => {
          const before = await snapshot();
          const body = await post(input, key, actor.token, 201);
          const after = await snapshot();
          unchangedFixtures(after);
          const rows = after.assignments.filter(
            (row) => !before.assignments.some((old) => old.id === row.id),
          );
          const claims = after.claims.filter(
            (row) => !before.claims.some((old) => old.id === row.id),
          );
          expect(rows).toHaveLength(1);
          expect(claims).toHaveLength(1);
          const row = rows[0];
          const claim = claims[0];
          expect(
            after.assignments.filter((item) => item.id !== row.id),
          ).toEqual(before.assignments);
          expect(after.claims.filter((item) => item.id !== claim.id)).toEqual(
            before.claims,
          );
          expect(row.id).toMatch(/^[a-f0-9-]{36}$/);
          expect(row.createdAt).toBeInstanceOf(Date);
          expect(row.updatedAt).toBeInstanceOf(Date);
          expect(row).toEqual({
            id: row.id,
            companyId: actor.companyId,
            caseId: input.caseId,
            equipmentAssetId: input.equipmentAssetId,
            requirementId: input.requirementId ?? null,
            origin: input.requirementId ? 'REQUIREMENT' : 'DIRECT',
            lifecycle: 'RESERVED',
            directAssignmentReason:
              input.directAssignmentReason?.trim() || null,
            createdById: actor.public.id,
            replacesAssignmentId: null,
            releasedAt: null,
            releasedById: null,
            releaseCause: null,
            releaseReason: null,
            replacedAt: null,
            replacedById: null,
            replacementReason: null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          });
          expect(claim.id).toMatch(/^[a-f0-9-]{36}$/);
          expect(claim.createdAt).toBeInstanceOf(Date);
          expect(claim.updatedAt).toBeInstanceOf(Date);
          expect(claim).toEqual({
            id: claim.id,
            companyId: actor.companyId,
            scope,
            key: key.trim(),
            requestHash: requestHash(input),
            resourceId: row.id,
            createdAt: claim.createdAt,
            updatedAt: claim.updatedAt,
          });
          expect(body).toEqual(
            publicSuccess(row, actor, equipmentAsset, prod, availability),
          );
          return { row, body };
        };
        const noWriteRequest = async (
          input: Input,
          key: string | undefined,
          bearer: string | undefined,
          status: number,
          expected: unknown,
        ) => {
          const before = await snapshot();
          const body = await post(input, key, bearer, status);
          expect(body).toEqual(expected);
          expect(await snapshot()).toEqual(before);
          return body;
        };
        const errorBody = (
          statusCode: 400 | 404 | 409 | 500,
          code: string,
          message: string,
        ) => ({
          statusCode,
          error: {
            400: 'Bad Request',
            404: 'Not Found',
            409: 'Conflict',
            500: 'Internal Server Error',
          }[statusCode],
          code,
          message,
        });
        const reject = (
          input: Input,
          status: 400 | 404 | 409,
          code: string,
          message: string,
          key: string = randomUUID(),
        ) =>
          noWriteRequest(
            input,
            key,
            token,
            status,
            errorBody(status, code, message),
          );
        const linked: Input = {
          caseId: c1.id,
          equipmentAssetId: x.id,
          requirementId: r1.id,
        };
        const direct = (caseId: string, equipmentAssetId: string): Input => ({
          caseId,
          equipmentAssetId,
          directAssignmentReason: '  B2 direct assignment  ',
        });

        const firstKey = `c5b2-${randomUUID()}`;
        const first = await success(
          linked,
          `  ${firstKey}  `,
          admin,
          x,
          p1,
          available,
        );
        await noWriteRequest(
          { ...linked, directAssignmentReason: null },
          firstKey,
          token,
          201,
          first.body,
        );
        await reject(
          { ...linked, equipmentAssetId: y.id },
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'La clave de idempotencia ya fue utilizada con una solicitud diferente',
          firstKey,
        );
        await reject(
          { ...linked, equipmentAssetId: y.id },
          409,
          'REQUIREMENT_OVER_COVERAGE',
          'La cantidad solicitada del requerimiento ya está cubierta',
        );
        const managerInput = direct(c1.id, y.id);
        const managerKey = randomUUID();
        const managerResult = await success(
          managerInput,
          managerKey,
          manager,
          y,
          p1,
          available,
        );
        await noWriteRequest(
          { ...managerInput, directAssignmentReason: 'B2 direct assignment' },
          managerKey,
          manager.token,
          201,
          managerResult.body,
        );
        await checkBoundary();

        await success(
          direct(ci.id, x.id),
          randomUUID(),
          warehouse,
          x,
          p1,
          incomplete,
        );
        await success(
          direct(c3.id, x.id),
          randomUUID(),
          admin,
          x,
          p1,
          uncertain,
        );
        await checkBoundary();

        // Initial review only: no confirmation, override INSERT or consumed key.
        const reviewInput = direct(c2.id, y.id);
        const reviewKey = randomUUID();
        const reviewExpected = {
          outcome: 'CONFLICT_REVIEW_REQUIRED',
          conflictReviewFingerprint: expect.stringMatching(
            /^[a-f0-9]{64}$/,
          ) as unknown,
          overrideRequired: true,
          conflicts: [
            {
              assignmentId: managerResult.row.id,
              caseId: c1.id,
              caseFolio: c1.folio,
              windowStart: '2026-11-01T10:00:00.000Z',
              windowEnd: '2026-11-01T16:00:00.000Z',
            },
          ],
          candidate: {
            caseId: c2.id,
            requirementId: null,
            origin: 'DIRECT',
            equipmentAsset: publicAsset(y, p1),
            operationalWindow: {
              start: '2026-11-01T10:00:00.000Z',
              end: '2026-11-01T16:00:00.000Z',
            },
          },
          unresolvedReservations: [],
          availability: conflicting,
        };
        const review = await noWriteRequest(
          reviewInput,
          reviewKey,
          token,
          200,
          reviewExpected,
        );
        await noWriteRequest(reviewInput, reviewKey, token, 200, review);
        await checkBoundary();

        const foreignInput: Input = {
          caseId: cb.id,
          equipmentAssetId: xb.id,
          requirementId: rb.id,
        };
        const foreignResult = await success(
          foreignInput,
          firstKey,
          adminB,
          xb,
          pb,
          available,
        );
        expect(foreignResult.row.id).not.toBe(first.row.id);
        await noWriteRequest(
          direct(c3.id, y.id),
          randomUUID(),
          sales.token,
          403,
          {
            statusCode: 403,
            message: 'Forbidden resource',
            error: 'Forbidden',
          },
        );
        await noWriteRequest(
          direct(c3.id, y.id),
          randomUUID(),
          undefined,
          401,
          {
            statusCode: 401,
            message: 'Unauthorized',
          },
        );
        for (const key of [undefined, '', ' '.repeat(3), 'x'.repeat(129)]) {
          await noWriteRequest(direct(c3.id, y.id), key, token, 400, {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Se requiere una clave Idempotency-Key válida',
          });
        }
        await reject(
          { ...linked, directAssignmentReason: 'not allowed' },
          400,
          'INVALID_ASSIGNMENT_ORIGIN',
          'La relación entre Requirement, origen y razón no es válida',
        );

        for (const [field, foreignId, code, message] of [
          ['caseId', cb.id, 'CASE_NOT_FOUND', 'Caso no encontrado'],
          [
            'requirementId',
            rb.id,
            'REQUIREMENT_NOT_FOUND',
            'Requerimiento no encontrado',
          ],
          [
            'equipmentAssetId',
            xb.id,
            'EQUIPMENT_ASSET_NOT_FOUND',
            'Equipo no encontrado',
          ],
        ] as const) {
          // Foreign Case uses DIRECT so an unrelated Requirement mismatch cannot mask it.
          const valid =
            field === 'caseId' ? direct(c3.id, y.id) : { ...linked };
          const foreignError = await reject(
            { ...valid, [field]: foreignId },
            404,
            code,
            message,
          );
          const missingError = await reject(
            { ...valid, [field]: randomUUID() },
            404,
            code,
            message,
          );
          expect(foreignError).toEqual(missingError);
        }
        await reject(
          direct(cc.id, y.id),
          409,
          'CASE_EQUIPMENT_ASSIGNMENTS_READ_ONLY',
          'Las asignaciones de equipo del caso son de sólo lectura',
        );
        await reject(
          { ...linked, requirementId: r2.id },
          409,
          'ASSIGNMENT_REQUIREMENT_CASE_MISMATCH',
          'El requerimiento no pertenece al caso indicado',
        );
        await reject(
          { caseId: c1.id, equipmentAssetId: w.id, requirementId: retired.id },
          409,
          'REQUIREMENT_RETIRED',
          'El requerimiento existe pero está retirado',
        );
        await reject(
          { ...linked, equipmentAssetId: w.id },
          409,
          'ASSIGNMENT_PRODUCT_MISMATCH',
          'El producto del equipo no coincide con el requerimiento',
        );
        await reject(
          direct(c3.id, z.id),
          409,
          'EQUIPMENT_ASSET_NOT_ELIGIBLE',
          'El equipo no está disponible para una nueva asignación',
        );
        await reject(
          linked,
          409,
          'ASSIGNMENT_ALREADY_RESERVED',
          'El equipo ya está reservado para este caso',
        );
        await checkBoundary();

        const retryInput = direct(c3.id, y.id);
        const retryKey = randomUUID();
        const repository = app.get(HealthcareEquipmentAssignmentsRepository);
        // The service awaits this method; expose its Promise contract to the spy
        // without pretending the injected promise supports Prisma relation chaining.
        const completionTarget: {
          completeIdempotencyClaim: (
            ...args: Parameters<typeof repository.completeIdempotencyClaim>
          ) => Promise<{ id: string }>;
        } = repository;
        // INJECTED FAILURE, not a native PostgreSQL fault. The claim and Assignment
        // must already exist in the real transaction before completion is interrupted.
        const completion = jest
          .spyOn(completionTarget, 'completeIdempotencyClaim')
          .mockImplementationOnce(async (transaction, claimId, resourceId) => {
            const pendingClaim =
              await transaction.idempotencyRecord.findUniqueOrThrow({
                where: { id: claimId },
              });
            const pendingAssignment =
              await transaction.healthcareEquipmentAssignment.findUniqueOrThrow(
                { where: { id: resourceId } },
              );
            expect(pendingClaim).toMatchObject({
              companyId: a.id,
              scope,
              key: retryKey,
              resourceId: null,
            });
            expect(pendingAssignment).toMatchObject({
              companyId: a.id,
              caseId: c3.id,
              equipmentAssetId: y.id,
              createdById: a.userId,
            });
            throw new Prisma.PrismaClientKnownRequestError(
              'B2 INJECTED completion failure',
              {
                code: 'P2025',
                clientVersion: Prisma.prismaVersion.client,
              },
            );
          });
        try {
          await noWriteRequest(
            retryInput,
            retryKey,
            token,
            500,
            errorBody(
              500,
              'HEALTHCARE_PERSISTENCE_ERROR',
              'No fue posible completar la operación',
            ),
          );
          expect(completion).toHaveBeenCalledTimes(1);
        } finally {
          completion.mockRestore();
        }
        await checkBoundary();
        await success(retryInput, retryKey, admin, y, p1, available);
        await checkBoundary();
        const final = await snapshot();
        unchangedFixtures(final);
        expect(final.assignments).toHaveLength(6);
        expect(final.claims).toHaveLength(6);
        expect(
          final.claims.every(
            (claim) =>
              claim.scope === scope &&
              final.assignments.some(
                (row) =>
                  row.id === claim.resourceId &&
                  row.companyId === claim.companyId,
              ),
          ),
        ).toBe(true);
        await checkBoundary();
        // B0 owns app shutdown, marker re-accreditation, ordered cleanup and zero residue.
      });
    }, 120_000);
  },
);
