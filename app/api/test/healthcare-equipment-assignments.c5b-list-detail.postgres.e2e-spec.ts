// Keep the disabled path inert: even describe.skip evaluates its callback.
const c5bListDetailEnabled = process.env.RUN_HC_C5B_POSTGRES_TESTS === '1';

(c5bListDetailEnabled ? describe : describe.skip)(
  'HC-NEXT-03C5-B1 List/Detail HTTP persisted readback',
  () => {
    it('proves public reads, roles, tenant isolation and schedule recomputation with owned fixtures', async () => {
      const { withC5bHarness } =
        await import('./helpers/healthcare-c5b-harness');
      const { randomUUID } = await import('node:crypto');
      const { JwtService } = await import('@nestjs/jwt');
      const { default: supertest } = await import('supertest');
      const { UserRole } = await import('@prisma/client');

      await withC5bHarness(async (context) => {
        const { prisma, app, owners, token, checkBoundary } = context;
        const [ownerA, ownerB] = owners;
        const companyIds = owners.map((owner) => owner.id);
        const baseTime = new Date('2026-10-01T00:00:00.000Z');
        const reservedTime = new Date('2026-10-03T00:00:00.000Z');
        const auditTime = new Date('2026-10-02T00:00:00.000Z');
        const completeAvailability = {
          fullyVerifiable: true,
          conflictFree: true,
          warnings: [],
        };
        const incompleteAvailability = {
          fullyVerifiable: false,
          conflictFree: null,
          warnings: [
            {
              code: 'INCOMPLETE_CASE_SCHEDULE',
              message: 'La disponibilidad requiere revisar el horario del caso',
            },
          ],
        };
        const relatedIncompleteAvailability = {
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
        const conflictAvailability = {
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

        // Every builder binds the accredited tenant; no external dependencies.
        const createCase = async (
          owner: (typeof owners)[number],
          scheduledStart: Date | null,
          scheduledEnd: Date | null,
        ) => {
          const id = randomUUID();
          return prisma.healthcareCase.create({
            data: {
              id,
              companyId: owner.id,
              folio: `C5B1-${id}`,
              title: 'B1 readback case',
              createdById: owner.userId,
              scheduledStart,
              scheduledEnd,
              createdAt: baseTime,
              updatedAt: baseTime,
            },
          });
        };
        const createTenantFixtures = async (
          owner: (typeof owners)[number],
          incomplete: boolean,
        ) => {
          const productId = randomUUID();
          const product = await prisma.product.create({
            data: {
              id: productId,
              companyId: owner.id,
              sku: `C5B1-${productId}`,
              name: 'B1 equipment',
              inventoryTracking: 'ASSET',
              createdAt: baseTime,
              updatedAt: baseTime,
            },
          });
          const healthcareCase = await createCase(
            owner,
            incomplete ? null : new Date('2026-11-03T12:00:00.000Z'),
            incomplete ? null : new Date('2026-11-03T13:00:00.000Z'),
          );
          const requirement = await prisma.healthcareCaseRequirement.create({
            data: {
              id: randomUUID(),
              companyId: owner.id,
              caseId: healthcareCase.id,
              productId,
              requestedQty: 1,
              type: 'REQUIRED',
              sortOrder: 10,
              createdById: owner.userId,
              createdAt: baseTime,
              updatedAt: baseTime,
            },
          });
          return { owner, product, healthcareCase, requirement };
        };
        type TenantFixtures = Awaited<ReturnType<typeof createTenantFixtures>>;
        const createAsset = async (fixture: TenantFixtures) => {
          const id = randomUUID();
          return prisma.equipmentAsset.create({
            data: {
              id,
              companyId: fixture.owner.id,
              productId: fixture.product.id,
              assetCode: `C5B1-${id}`,
              condition: 'GOOD',
              createdAt: baseTime,
              updatedAt: baseTime,
            },
          });
        };

        await checkBoundary();
        const a = await createTenantFixtures(ownerA, true);
        const b = await createTenantFixtures(ownerB, false);
        const caseC2 = await createCase(
          ownerA,
          new Date('2026-11-03T12:00:00.000Z'),
          new Date('2026-11-03T13:00:00.000Z'),
        );
        const assetA1 = await createAsset(a);
        const assetA2 = await createAsset(a);
        const assetB = await createAsset(b);
        const predecessor = await prisma.healthcareEquipmentAssignment.create({
          data: {
            id: randomUUID(),
            companyId: ownerA.id,
            caseId: a.healthcareCase.id,
            requirementId: a.requirement.id,
            equipmentAssetId: assetA2.id,
            origin: 'REQUIREMENT',
            lifecycle: 'REPLACED',
            createdById: ownerA.userId,
            createdAt: baseTime,
            updatedAt: auditTime,
            replacedAt: auditTime,
            replacedById: ownerA.userId,
            replacementReason: 'B1 historical replacement',
          },
        });
        const current = await prisma.healthcareEquipmentAssignment.create({
          data: {
            id: randomUUID(),
            companyId: ownerA.id,
            caseId: a.healthcareCase.id,
            requirementId: a.requirement.id,
            equipmentAssetId: assetA1.id,
            origin: 'REQUIREMENT',
            replacesAssignmentId: predecessor.id,
            createdById: ownerA.userId,
            createdAt: reservedTime,
            updatedAt: reservedTime,
          },
        });
        const other = await prisma.healthcareEquipmentAssignment.create({
          data: {
            id: randomUUID(),
            companyId: ownerA.id,
            caseId: caseC2.id,
            equipmentAssetId: assetA1.id,
            origin: 'DIRECT',
            directAssignmentReason: 'B1 other reservation',
            createdById: ownerA.userId,
            createdAt: reservedTime,
            updatedAt: reservedTime,
          },
        });
        const released = await prisma.healthcareEquipmentAssignment.create({
          data: {
            id: randomUUID(),
            companyId: ownerA.id,
            caseId: a.healthcareCase.id,
            equipmentAssetId: assetA2.id,
            origin: 'DIRECT',
            directAssignmentReason: 'B1 historical direct assignment',
            lifecycle: 'RELEASED',
            createdById: ownerA.userId,
            createdAt: new Date('2026-10-01T01:00:00.000Z'),
            updatedAt: auditTime,
            releasedAt: auditTime,
            releasedById: ownerA.userId,
            releaseCause: 'MANUAL',
            releaseReason: 'B1 historical release',
          },
        });
        const foreign = await prisma.healthcareEquipmentAssignment.create({
          data: {
            id: randomUUID(),
            companyId: ownerB.id,
            caseId: b.healthcareCase.id,
            requirementId: b.requirement.id,
            equipmentAssetId: assetB.id,
            origin: 'REQUIREMENT',
            createdById: ownerB.userId,
            createdAt: reservedTime,
            updatedAt: reservedTime,
          },
        });

        const tokens = new Map<string, string>([['ADMIN', token]]);
        const signPersistedUser = async (companyId: string, id: string) => {
          const user = await prisma.user.findFirstOrThrow({
            where: { id, companyId, isActive: true },
            select: {
              id: true,
              companyId: true,
              email: true,
              role: true,
              authVersion: true,
            },
          });
          return app.get(JwtService).sign({
            sub: user.id,
            companyId: user.companyId,
            email: user.email,
            role: user.role,
            authVersion: user.authVersion,
          });
        };
        for (const role of [
          UserRole.MANAGER,
          UserRole.SALES,
          UserRole.WAREHOUSE,
        ]) {
          const id = randomUUID();
          await prisma.user.create({
            data: {
              id,
              companyId: ownerA.id,
              email: `c5b1-${id}@example.invalid`,
              firstName: 'B1',
              lastName: role,
              passwordHash: 'not-a-login-credential',
              role,
              isActive: true,
              authVersion: 0,
              createdAt: baseTime,
              updatedAt: baseTime,
            },
          });
          tokens.set(role, await signPersistedUser(ownerA.id, id));
        }
        const tokenB = await signPersistedUser(ownerB.id, ownerB.userId);

        // Explicit public objects make extra keys, raw relations and nested leaks fail.
        const publicAsset = (
          asset: Awaited<ReturnType<typeof createAsset>>,
          fixture: TenantFixtures,
        ) => ({
          id: asset.id,
          productId: fixture.product.id,
          assetCode: asset.assetCode,
          serialNumber: null,
          lifecycle: 'ACTIVE',
          condition: 'GOOD',
          product: {
            id: fixture.product.id,
            sku: fixture.product.sku,
            name: 'B1 equipment',
            isActive: true,
          },
        });
        const actorA = {
          id: ownerA.userId,
          firstName: 'C5B',
          lastName: 'Smoke',
        };
        const actorB = {
          id: ownerB.userId,
          firstName: 'C5B',
          lastName: 'Smoke',
        };
        const expectedAssignment = (
          row: typeof current,
          equipmentAsset: ReturnType<typeof publicAsset>,
          assignedBy: typeof actorA,
          availability: unknown,
        ): Record<string, unknown> => ({
          id: row.id,
          caseId: row.caseId,
          requirementId: row.requirementId,
          origin: row.origin,
          status: row.lifecycle,
          equipmentAsset,
          assignedAt: row.createdAt.toISOString(),
          assignedBy,
          ...(row.origin === 'DIRECT'
            ? { directAssignmentReason: row.directAssignmentReason }
            : {}),
          replacesAssignmentId: row.replacesAssignmentId,
          replacement: null,
          release: null,
          availability,
          conflictOverrides: [],
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        });
        const expected = new Map<string, Record<string, unknown>>([
          [
            current.id,
            expectedAssignment(
              current,
              publicAsset(assetA1, a),
              actorA,
              incompleteAvailability,
            ),
          ],
          [
            other.id,
            expectedAssignment(
              other,
              publicAsset(assetA1, a),
              actorA,
              relatedIncompleteAvailability,
            ),
          ],
          [
            released.id,
            {
              ...expectedAssignment(
                released,
                publicAsset(assetA2, a),
                actorA,
                null,
              ),
              release: {
                cause: 'MANUAL',
                reason: 'B1 historical release',
                releasedAt: auditTime.toISOString(),
                releasedBy: actorA,
              },
            },
          ],
          [
            predecessor.id,
            {
              ...expectedAssignment(
                predecessor,
                publicAsset(assetA2, a),
                actorA,
                null,
              ),
              replacement: {
                successorAssignmentId: current.id,
                reason: 'B1 historical replacement',
                replacedAt: auditTime.toISOString(),
                replacedBy: actorA,
              },
            },
          ],
          [
            foreign.id,
            expectedAssignment(
              foreign,
              publicAsset(assetB, b),
              actorB,
              completeAvailability,
            ),
          ],
        ]);
        const route = '/healthcare/equipment-assignments';
        const get = async (
          path: string,
          bearer: string | undefined,
          status: number,
          query: Record<string, string | number> = {},
        ): Promise<unknown> => {
          let request = supertest(app.getHttpServer()).get(path).query(query);
          if (bearer) request = request.auth(bearer, { type: 'bearer' });
          const response = await request.timeout({
            response: 10000,
            deadline: 15000,
          });
          expect(response.status).toBe(status);
          return response.body as unknown;
        };
        const list = async (
          ids: string[],
          query: Record<string, string | number> = {},
          bearer = token,
          page = 1,
          pageSize = 25,
          totalItems = ids.length,
        ) => {
          expect(await get(route, bearer, 200, query)).toEqual({
            items: ids.map((id) => expected.get(id)),
            pagination: {
              page,
              pageSize,
              totalItems,
              totalPages: Math.ceil(totalItems / pageSize),
            },
          });
        };
        const detail = async (id: string, bearer = token) => {
          expect(await get(`${route}/${id}`, bearer, 200)).toEqual(
            expected.get(id),
          );
        };
        const readAssignments = () =>
          prisma.healthcareEquipmentAssignment.findMany({
            where: { companyId: { in: companyIds } },
            orderBy: { id: 'asc' },
          });
        const pristineAssignments = await readAssignments();
        const readOnlyPhase = async (operation: () => Promise<void>) => {
          await checkBoundary();
          const before = await readAssignments();
          expect(before).toEqual(pristineAssignments);
          await operation();
          // Compare every persisted scalar, including all IDs, audit fields and timestamps.
          expect(await readAssignments()).toEqual(before);
          await checkBoundary();
        };
        const reservedIds = [current.id, other.id].sort();
        const allIds = [...reservedIds, released.id, predecessor.id];

        await readOnlyPhase(async () => {
          await get(route, undefined, 401);
          await get(`${route}/${current.id}`, undefined, 401);
          for (const bearer of tokens.values()) {
            await list(reservedIds, {}, bearer);
            await detail(current.id, bearer);
          }
          await list([foreign.id], { status: 'ALL' }, tokenB);
          await detail(foreign.id, tokenB);
          const foreignDetail = await get(`${route}/${foreign.id}`, token, 404);
          expect(foreignDetail).toEqual({
            statusCode: 404,
            error: 'Not Found',
            code: 'EQUIPMENT_ASSIGNMENT_NOT_FOUND',
            message: 'Asignación de equipo no encontrada',
          });
          expect(await get(`${route}/${randomUUID()}`, token, 404)).toEqual(
            foreignDetail,
          );
          for (const [field, id, code, message] of [
            [
              'caseId',
              b.healthcareCase.id,
              'CASE_NOT_FOUND',
              'Caso no encontrado',
            ],
            [
              'requirementId',
              b.requirement.id,
              'REQUIREMENT_NOT_FOUND',
              'Requerimiento no encontrado',
            ],
            [
              'equipmentAssetId',
              assetB.id,
              'EQUIPMENT_ASSET_NOT_FOUND',
              'Equipo no encontrado',
            ],
          ]) {
            const foreignFilter = await get(route, token, 404, { [field]: id });
            expect(foreignFilter).toEqual({
              statusCode: 404,
              error: 'Not Found',
              code,
              message,
            });
            expect(
              await get(route, token, 404, { [field]: randomUUID() }),
            ).toEqual(foreignFilter);
          }
          await get(`${route}/not-a-uuid`, token, 400);
          await get(route, token, 400, { pageSize: 101 });
        });

        await readOnlyPhase(async () => {
          await list(allIds, { status: 'ALL' });
          await list(reservedIds, { status: 'RESERVED' });
          await list([released.id], { status: 'RELEASED' });
          await list([predecessor.id], { status: 'REPLACED' });
          await list([other.id, released.id], {
            status: 'ALL',
            origin: 'DIRECT',
          });
          await list([current.id, predecessor.id], {
            status: 'ALL',
            origin: 'REQUIREMENT',
          });
          await list([current.id, released.id, predecessor.id], {
            status: 'ALL',
            caseId: a.healthcareCase.id,
          });
          await list([current.id, predecessor.id], {
            status: 'ALL',
            requirementId: a.requirement.id,
          });
          await list([released.id, predecessor.id], {
            status: 'ALL',
            equipmentAssetId: assetA2.id,
          });
          await list([current.id], {
            status: 'ALL',
            origin: 'REQUIREMENT',
            caseId: a.healthcareCase.id,
            requirementId: a.requirement.id,
            equipmentAssetId: assetA1.id,
          });
          // Both reserved rows share createdAt; page boundaries prove the id tie-break.
          await list(
            [reservedIds[0]],
            { page: 1, pageSize: 1 },
            token,
            1,
            1,
            2,
          );
          await list(
            [reservedIds[1]],
            { page: 2, pageSize: 1 },
            token,
            2,
            1,
            2,
          );
          await list([], { page: 3, pageSize: 1 }, token, 3, 1, 2);
          await list([], { equipmentAssetId: assetA2.id });
          await detail(released.id);
          await detail(predecessor.id);
          await detail(current.id);
        });

        const assertCurrentReadback = async () => {
          await list([current.id], { caseId: a.healthcareCase.id });
          await detail(current.id);
        };
        await readOnlyPhase(assertCurrentReadback);

        const mutateSchedule = async (
          start: string,
          end: string,
          updated: string,
        ) => {
          await checkBoundary();
          const before = await prisma.healthcareCase.findUniqueOrThrow({
            where: { id: a.healthcareCase.id },
          });
          const schedule = {
            scheduledStart: new Date(start),
            scheduledEnd: new Date(end),
            updatedAt: new Date(updated),
          };
          // Only these three columns are authorized by the existing B0 ACL.
          await prisma.healthcareCase.update({
            where: { id: a.healthcareCase.id, companyId: ownerA.id },
            data: schedule,
          });
          expect(
            await prisma.healthcareCase.findUniqueOrThrow({
              where: { id: a.healthcareCase.id },
            }),
          ).toEqual({ ...before, ...schedule });
          expect(await readAssignments()).toEqual(pristineAssignments);
          await checkBoundary();
        };
        await mutateSchedule(
          '2026-11-01T12:00:00.000Z',
          '2026-11-01T13:00:00.000Z',
          '2026-10-04T00:00:00.000Z',
        );
        expected.get(current.id)!.availability = completeAvailability;
        expected.get(other.id)!.availability = completeAvailability;
        await readOnlyPhase(async () => {
          await assertCurrentReadback();
          await list(reservedIds);
          await detail(other.id);
        });

        await mutateSchedule(
          '2026-11-03T12:30:00.000Z',
          '2026-11-03T13:30:00.000Z',
          '2026-10-05T00:00:00.000Z',
        );
        expected.get(current.id)!.availability = conflictAvailability;
        expected.get(other.id)!.availability = conflictAvailability;
        await readOnlyPhase(async () => {
          await assertCurrentReadback();
          await list(reservedIds);
          await detail(other.id);
          await detail(released.id);
          await detail(predecessor.id);
          expect(
            await prisma.healthcareEquipmentAssignmentSettings.count({
              where: { companyId: { in: companyIds } },
            }),
          ).toBe(0);
          expect(
            await prisma.healthcareEquipmentAssignmentConflictOverride.count({
              where: { companyId: { in: companyIds } },
            }),
          ).toBe(0);
          expect(
            await prisma.idempotencyRecord.count({
              where: { companyId: { in: companyIds } },
            }),
          ).toBe(0);
        });
      });
    }, 120_000);
  },
);
