// Inert until a separate human-reviewed PostgreSQL/ACL run is authorized.
const coverageEnabled = process.env.RUN_HC_C5B_POSTGRES_TESTS === '1';
(coverageEnabled ? describe : describe.skip)(
  'HC-NEXT-03C5-COVERAGE-R HTTP/JWT persisted reads',
  () => {
    it('proves quantities, exact overrides, tenant/RBAC, audit history and zero-write reads with owned fixtures', async () => {
      const { withC5bHarness } =
        await import('./helpers/healthcare-c5b-harness');
      const { randomUUID } = await import('node:crypto');
      const { JwtService } = await import('@nestjs/jwt');
      const { default: supertest } = await import('supertest');
      const { UserRole } = await import('@prisma/client');
      const {
        deriveEquipmentAssignmentOperationalWindow,
        resolveEquipmentAssignmentBuffers,
      } =
        await import('../src/healthcare/equipment-assignments/healthcare-equipment-assignment-availability');
      await withC5bHarness(
        async ({ prisma, app, owners, token, checkBoundary }) => {
          const [ownerA, ownerB] = owners;
          const companyIds = owners.map((owner) => owner.id);
          const start = new Date('2026-11-04T12:00:00.000Z');
          const end = new Date('2026-11-04T13:00:00.000Z');
          const audit = new Date('2026-10-09T00:00:00.000Z');
          const createCase = (owner: typeof ownerA, incomplete = false) => {
            const id = randomUUID();
            return prisma.healthcareCase.create({
              data: {
                id,
                companyId: owner.id,
                folio: `C5R-${id}`,
                title: 'Owned coverage read case',
                createdById: owner.userId,
                scheduledStart: incomplete ? null : start,
                scheduledEnd: incomplete ? null : end,
              },
            });
          };
          const createProduct = (
            owner: typeof ownerA,
            tracking: 'ASSET' | 'QUANTITY' = 'ASSET',
          ) => {
            const id = randomUUID();
            return prisma.product.create({
              data: {
                id,
                companyId: owner.id,
                sku: `C5R-${id}`,
                name: 'Owned equipment',
                inventoryTracking: tracking,
              },
            });
          };
          await checkBoundary();
          const caseA = await createCase(ownerA);
          const caseB = await createCase(ownerB);
          const incompleteCase = await createCase(ownerA, true);
          const productA = await createProduct(ownerA);
          const wrongProduct = await createProduct(ownerA);
          const quantityProduct = await createProduct(ownerA, 'QUANTITY');
          const productB = await createProduct(ownerB);
          const createRequirement = (
            owner: typeof ownerA,
            caseId: string,
            productId: string,
            qty: number,
            sortOrder: number,
            retired = false,
          ) =>
            prisma.healthcareCaseRequirement.create({
              data: {
                id: randomUUID(),
                companyId: owner.id,
                caseId,
                productId,
                requestedQty: qty,
                type: 'REQUIRED',
                sortOrder,
                createdById: owner.userId,
                ...(retired
                  ? {
                      lifecycle: 'RETIRED',
                      retiredAt: audit,
                      retiredById: owner.userId,
                      retirementReason: 'Owned retired fixture',
                    }
                  : {}),
              },
            });
          const pending = await createRequirement(
            ownerA,
            caseA.id,
            productA.id,
            3,
            1,
          );
          // Requirements are unique by Case+Product; each state uses its own Product.
          const makeState = async (qty: number, order: number) => {
            const product = await createProduct(ownerA);
            const requirement = await createRequirement(
              ownerA,
              caseA.id,
              product.id,
              qty,
              order,
            );
            return { requirement, product };
          };
          const unavailable = await makeState(2, 2);
          const partial = await makeState(2, 3);
          const covered = await makeState(1, 4);
          const uncertain = await makeState(1, 5);
          const overridden = await makeState(1, 6);
          const inactive = await makeState(1, 7);
          const retiredProduct = await createProduct(ownerA);
          const retired = await createRequirement(
            ownerA,
            caseA.id,
            retiredProduct.id,
            1,
            8,
            true,
          );
          const nonEquipmentRequirement = await createRequirement(
            ownerA,
            caseA.id,
            quantityProduct.id,
            1,
            9,
          );
          const foreignRequirement = await createRequirement(
            ownerB,
            caseB.id,
            productB.id,
            1,
            1,
          );
          const otherRequirement = await createRequirement(
            ownerA,
            incompleteCase.id,
            productA.id,
            1,
            1,
          );
          const createAsset = (
            productId: string,
            condition: 'GOOD' | 'DAMAGED' = 'GOOD',
            lifecycle: 'ACTIVE' | 'RETIRED' = 'ACTIVE',
          ) => {
            const id = randomUUID();
            return prisma.equipmentAsset.create({
              data: {
                id,
                companyId: ownerA.id,
                productId,
                assetCode: `C5R-${id}`,
                condition,
                lifecycle,
              },
            });
          };
          const reserve = (
            caseId: string,
            requirementId: string | null,
            equipmentAssetId: string,
            lifecycle: 'RESERVED' | 'RELEASED' | 'REPLACED' = 'RESERVED',
          ) =>
            prisma.healthcareEquipmentAssignment.create({
              data: {
                id: randomUUID(),
                companyId: ownerA.id,
                caseId,
                requirementId,
                equipmentAssetId,
                origin: requirementId ? 'REQUIREMENT' : 'DIRECT',
                createdById: ownerA.userId,
                ...(!requirementId
                  ? { directAssignmentReason: 'Owned direct fixture' }
                  : {}),
                lifecycle,
                ...(lifecycle === 'RELEASED'
                  ? {
                      releasedAt: audit,
                      releasedById: ownerA.userId,
                      releaseCause: 'MANUAL',
                      releaseReason: 'Owned released fixture',
                    }
                  : {}),
                ...(lifecycle === 'REPLACED'
                  ? {
                      replacedAt: audit,
                      replacedById: ownerA.userId,
                      replacementReason: 'Owned replaced fixture',
                    }
                  : {}),
              },
            });
          const note = (
            requirementId: string,
            kind: 'UNAVAILABLE' | 'PARTIAL_CONTEXT',
            resolved = false,
          ) =>
            prisma.healthcareEquipmentRequirementCoverageNote.create({
              data: {
                id: randomUUID(),
                companyId: ownerA.id,
                requirementId,
                kind,
                comment: 'Owned operational context',
                recordedById: ownerA.userId,
                createdAt: audit,
                ...(resolved
                  ? { resolvedAt: audit, resolvedById: ownerA.userId }
                  : {}),
              },
            });
          const activeUnavailable = await note(
            unavailable.requirement.id,
            'UNAVAILABLE',
          );
          const history = await note(
            unavailable.requirement.id,
            'UNAVAILABLE',
            true,
          );
          await note(partial.requirement.id, 'PARTIAL_CONTEXT');
          await note(covered.requirement.id, 'UNAVAILABLE'); // intentionally stale context
          await reserve(
            caseA.id,
            partial.requirement.id,
            (await createAsset(partial.product.id)).id,
          );
          await reserve(
            caseA.id,
            covered.requirement.id,
            (await createAsset(covered.product.id)).id,
          );
          await reserve(
            caseA.id,
            pending.id,
            (await createAsset(wrongProduct.id)).id,
          );
          await reserve(
            caseA.id,
            inactive.requirement.id,
            (await createAsset(inactive.product.id, 'DAMAGED')).id,
          );
          await reserve(
            caseA.id,
            inactive.requirement.id,
            (await createAsset(inactive.product.id, 'GOOD', 'RETIRED')).id,
          );
          await reserve(
            caseA.id,
            pending.id,
            (await createAsset(productA.id)).id,
            'RELEASED',
          );
          await reserve(
            caseA.id,
            pending.id,
            (await createAsset(productA.id)).id,
            'REPLACED',
          );
          await reserve(caseA.id, null, (await createAsset(productA.id)).id);
          const uncertainAsset = await createAsset(uncertain.product.id);
          await reserve(caseA.id, uncertain.requirement.id, uncertainAsset.id);
          await reserve(incompleteCase.id, null, uncertainAsset.id);
          const conflictAsset = await createAsset(overridden.product.id);
          const candidate = await reserve(
            caseA.id,
            overridden.requirement.id,
            conflictAsset.id,
          );
          const conflictCase = await createCase(ownerA);
          const conflict = await reserve(
            conflictCase.id,
            null,
            conflictAsset.id,
          );
          const settings =
            await prisma.healthcareEquipmentAssignmentSettings.findUnique({
              where: { companyId: ownerA.id },
            });
          const window = deriveEquipmentAssignmentOperationalWindow(
            caseA,
            resolveEquipmentAssignmentBuffers(settings),
          );
          if (!window)
            throw new Error('Owned complete case has no operational window');
          await prisma.healthcareEquipmentAssignmentConflictOverride.create({
            data: {
              id: randomUUID(),
              companyId: ownerA.id,
              assignmentId: candidate.id,
              conflictingAssignmentId: conflict.id,
              approvedById: ownerA.userId,
              reason: 'Owned confirmed conflict',
              assignmentWindowStart: window.start,
              assignmentWindowEnd: window.end,
              conflictingWindowStart: window.start,
              conflictingWindowEnd: window.end,
            },
          });
          // A separate applicable Assignment has two simultaneous conflicts;
          // only X is confirmed. This must suppress the aggregate OVERRIDE
          // even though the individual Assignment legitimately exposes it.
          const partiallyOverridden = await makeState(1, 10);
          const partialConflictAsset = await createAsset(
            partiallyOverridden.product.id,
          );
          const partialCandidate = await reserve(
            caseA.id,
            partiallyOverridden.requirement.id,
            partialConflictAsset.id,
          );
          const partialConflictXCase = await createCase(ownerA);
          const partialConflictYCase = await createCase(ownerA);
          const partialConflictX = await reserve(
            partialConflictXCase.id,
            null,
            partialConflictAsset.id,
          );
          await reserve(partialConflictYCase.id, null, partialConflictAsset.id);
          await prisma.healthcareEquipmentAssignmentConflictOverride.create({
            data: {
              id: randomUUID(),
              companyId: ownerA.id,
              assignmentId: partialCandidate.id,
              conflictingAssignmentId: partialConflictX.id,
              approvedById: ownerA.userId,
              reason: 'Only conflict X confirmed; Y remains unconfirmed',
              assignmentWindowStart: window.start,
              assignmentWindowEnd: window.end,
              conflictingWindowStart: window.start,
              conflictingWindowEnd: window.end,
            },
          });
          const route = `/healthcare/cases/${caseA.id}/equipment-coverage`;
          const notesRoute = `/healthcare/cases/${caseA.id}/requirements/${unavailable.requirement.id}/equipment-coverage-notes`;
          const countPhysical = async () => ({
            assignments: await prisma.healthcareEquipmentAssignment.findMany({
              where: { companyId: { in: companyIds } },
              orderBy: { id: 'asc' },
            }),
            notes:
              await prisma.healthcareEquipmentRequirementCoverageNote.findMany({
                where: { companyId: { in: companyIds } },
                orderBy: { id: 'asc' },
              }),
            overrides:
              await prisma.healthcareEquipmentAssignmentConflictOverride.findMany(
                {
                  where: { companyId: { in: companyIds } },
                  orderBy: { id: 'asc' },
                },
              ),
            assets: await prisma.equipmentAsset.findMany({
              where: { companyId: { in: companyIds } },
              orderBy: { id: 'asc' },
            }),
            products: await prisma.product.findMany({
              where: { companyId: { in: companyIds } },
              orderBy: { id: 'asc' },
            }),
          });
          await checkBoundary();
          const before = await countPhysical();
          const read = await supertest(app.getHttpServer())
            .get(route)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
          type CoverageRow = {
            requirementId: string;
            quantityState: string;
            nominalAssignedQty: number;
            assignedQty: number;
            availability: {
              fullyVerifiable: boolean;
              conflictFree: boolean | null;
              warnings: { code: string }[];
            };
            activeNotes: { id: string }[];
          };
          const rows = (read.body as { items: CoverageRow[] }).items;
          expect(rows.map((row) => row.requirementId)).not.toContain(
            retired.id,
          );
          expect(rows.map((row) => row.requirementId)).not.toContain(
            nonEquipmentRequirement.id,
          );
          const byId = (id: string) =>
            rows.find((row) => row.requirementId === id)!;
          expect(byId(pending.id)).toMatchObject({
            quantityState: 'PENDING',
            nominalAssignedQty: 1,
            assignedQty: 0,
          });
          expect(byId(unavailable.requirement.id)).toMatchObject({
            quantityState: 'UNAVAILABLE',
            activeNotes: [
              expect.objectContaining({ id: activeUnavailable.id }),
            ],
          });
          expect(byId(partial.requirement.id)).toMatchObject({
            quantityState: 'PARTIAL',
            assignedQty: 1,
          });
          expect(byId(covered.requirement.id)).toMatchObject({
            quantityState: 'COVERED',
            activeNotes: [expect.any(Object)],
          });
          expect(byId(inactive.requirement.id)).toMatchObject({
            nominalAssignedQty: 2,
            assignedQty: 0,
          });
          expect(byId(uncertain.requirement.id)).toMatchObject({
            quantityState: 'COVERED',
            availability: { fullyVerifiable: false, conflictFree: null },
          });
          expect(
            byId(overridden.requirement.id).availability.warnings.map(
              (w) => w.code,
            ),
          ).toEqual([
            'CURRENT_ASSIGNMENT_CONFLICT',
            'CONFLICT_OVERRIDE_CONFIRMED',
          ]);
          expect(byId(partiallyOverridden.requirement.id)).toMatchObject({
            assignedQty: 1,
            quantityState: 'COVERED',
            availability: { fullyVerifiable: true, conflictFree: false },
          });
          expect(
            byId(partiallyOverridden.requirement.id).availability.warnings.map(
              (warning) => warning.code,
            ),
          ).toEqual(['CURRENT_ASSIGNMENT_CONFLICT']);
          expect(JSON.stringify(read.body)).not.toMatch(
            /companyId|recordedById|resolvedById|assignmentWindowStart/,
          );
          const historyRead = await supertest(app.getHttpServer())
            .get(`${notesRoute}?pageSize=1`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
          type HistoryBody = {
            items: { id: string }[];
            pagination: { totalItems: number; totalPages: number };
          };
          expect((historyRead.body as HistoryBody).pagination).toMatchObject({
            totalItems: 2,
            totalPages: 2,
          });
          const secondPage = await supertest(app.getHttpServer())
            .get(`${notesRoute}?page=2&pageSize=1`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
          expect(
            new Set([
              (historyRead.body as HistoryBody).items[0].id,
              (secondPage.body as HistoryBody).items[0].id,
            ]),
          ).toEqual(new Set([activeUnavailable.id, history.id]));
          const jwt = app.get(JwtService);
          for (const role of [
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.SALES,
            UserRole.WAREHOUSE,
          ]) {
            const user = await prisma.user.create({
              data: {
                id: randomUUID(),
                companyId: ownerA.id,
                email: `c5r-${randomUUID()}@example.test`,
                passwordHash: 'not-a-login-credential',
                firstName: 'Reader',
                lastName: role,
                role,
              },
            });
            const roleToken = jwt.sign({
              sub: user.id,
              companyId: ownerA.id,
              email: user.email,
              role,
              authVersion: user.authVersion,
            });
            await supertest(app.getHttpServer())
              .get(route)
              .set('Authorization', `Bearer ${roleToken}`)
              .expect(200);
            await supertest(app.getHttpServer())
              .get(notesRoute)
              .set('Authorization', `Bearer ${roleToken}`)
              .expect(200);
          }
          for (const path of [route, notesRoute])
            await supertest(app.getHttpServer()).get(path).expect(401);
          const missing = await supertest(app.getHttpServer())
            .get(`/healthcare/cases/${randomUUID()}/equipment-coverage`)
            .set('Authorization', `Bearer ${token}`)
            .expect(404);
          const foreign = await supertest(app.getHttpServer())
            .get(`/healthcare/cases/${caseB.id}/equipment-coverage`)
            .set('Authorization', `Bearer ${token}`)
            .expect(404);
          expect(foreign.body).toEqual(missing.body);
          for (const id of [
            foreignRequirement.id,
            otherRequirement.id,
            randomUUID(),
          ])
            await supertest(app.getHttpServer())
              .get(
                `/healthcare/cases/${caseA.id}/requirements/${id}/equipment-coverage-notes`,
              )
              .set('Authorization', `Bearer ${token}`)
              .expect(404);
          for (const path of [
            route.replace(caseA.id, 'bad'),
            `${notesRoute}?page=0`,
            `${notesRoute}?pageSize=101`,
          ])
            await supertest(app.getHttpServer())
              .get(path)
              .set('Authorization', `Bearer ${token}`)
              .expect(400);
          expect(await countPhysical()).toEqual(before);
          // Rescheduling invalidates the exact override while preserving current overlap.
          await prisma.healthcareCase.update({
            where: { id: caseA.id },
            data: { scheduledEnd: new Date(end.getTime() + 60000) },
          });
          const rescheduled = await supertest(app.getHttpServer())
            .get(route)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
          expect(
            (rescheduled.body as { items: CoverageRow[] }).items
              .find((row) => row.requirementId === overridden.requirement.id)
              ?.availability.warnings.map((w) => w.code),
          ).toEqual(['CURRENT_ASSIGNMENT_CONFLICT']);
          await checkBoundary();
        },
      );
    }, 120000);
  },
);
