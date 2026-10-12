// Inert until the separate spike DB ACL review and PostgreSQL run are authorized.
const caseAvailabilityEnabled = process.env.RUN_HC_C5B_POSTGRES_TESTS === '1';
(caseAvailabilityEnabled ? describe : describe.skip)(
  'HC-CASE-AVL-R HTTP/JWT persisted read (no concurrency claim)',
  () => {
    it('projects owned persisted dimensions, isolates tenants and performs zero writes', async () => {
      const { withC5bHarness } =
        await import('./helpers/healthcare-c5b-harness');
      const { randomUUID } = await import('node:crypto');
      const { JwtService } = await import('@nestjs/jwt');
      const { default: supertest } = await import('supertest');
      const { UserRole, Prisma } = await import('@prisma/client');
      const {
        deriveEquipmentAssignmentOperationalWindow,
        resolveEquipmentAssignmentBuffers,
      } =
        await import('../src/healthcare/equipment-assignments/healthcare-equipment-assignment-availability');
      await withC5bHarness(
        async ({ prisma, app, owners, token, control, checkBoundary }) => {
          if (!control)
            throw new Error('C5AVL accredited fixture control required');
          const [a, b] = owners;
          const companyIds = owners.map((owner) => owner.id);
          const start = new Date('2026-11-04T12:00:00.000Z');
          const end = new Date('2026-11-04T13:00:00.000Z');
          const audit = new Date('2026-10-12T00:00:00.000Z');
          const createCase = (owner: typeof a, incomplete = false) => {
            const id = randomUUID();
            return prisma.healthcareCase.create({
              data: {
                id,
                companyId: owner.id,
                folio: `C5AVL-${id}`,
                title: 'Owned availability fixture',
                createdById: owner.userId,
                status: 'SCHEDULED',
                scheduledStart: incomplete ? null : start,
                scheduledEnd: incomplete ? null : end,
              },
            });
          };
          const requirement = async (
            owner: typeof a,
            caseId: string,
            qty: number,
            type: 'REQUIRED' | 'BACKUP' = 'REQUIRED',
            tracking: 'ASSET' | 'QUANTITY' = 'ASSET',
            retired = false,
          ) => {
            const productId = randomUUID();
            await prisma.product.create({
              data: {
                id: productId,
                companyId: owner.id,
                sku: `C5AVL-${productId}`,
                name: 'Owned availability product',
                inventoryTracking: tracking,
                stock: 7,
              },
            });
            return prisma.healthcareCaseRequirement.create({
              data: {
                id: randomUUID(),
                companyId: owner.id,
                caseId,
                productId,
                requestedQty: qty,
                sortOrder: 0,
                type,
                createdById: owner.userId,
                ...(retired
                  ? {
                      lifecycle: 'RETIRED',
                      retiredAt: audit,
                      retiredById: owner.userId,
                      retirementReason: 'C5AVL owned retired fixture',
                    }
                  : {}),
              },
            });
          };
          const asset = (owner: typeof a, productId: string) => {
            const id = randomUUID();
            return prisma.equipmentAsset.create({
              data: {
                id,
                companyId: owner.id,
                productId,
                assetCode: `C5AVL-${id}`,
                condition: 'GOOD',
              },
            });
          };
          const assignment = (
            owner: typeof a,
            caseId: string,
            equipmentAssetId: string,
            requirementId: string | null,
            lifecycle: 'RESERVED' | 'RELEASED' | 'REPLACED' = 'RESERVED',
          ) =>
            prisma.healthcareEquipmentAssignment.create({
              data: {
                id: randomUUID(),
                companyId: owner.id,
                caseId,
                equipmentAssetId,
                requirementId,
                origin: requirementId ? 'REQUIREMENT' : 'DIRECT',
                lifecycle,
                createdById: owner.userId,
                ...(!requirementId
                  ? { directAssignmentReason: 'C5AVL owned direct fixture' }
                  : {}),
                ...(lifecycle === 'RELEASED'
                  ? {
                      releasedAt: audit,
                      releasedById: owner.userId,
                      releaseCause: 'MANUAL',
                      releaseReason: 'C5AVL owned release fixture',
                    }
                  : {}),
                ...(lifecycle === 'REPLACED'
                  ? {
                      replacedAt: audit,
                      replacedById: owner.userId,
                      replacementReason: 'C5AVL owned replacement fixture',
                    }
                  : {}),
              },
            });
          const note = (
            owner: typeof a,
            requirementId: string,
            resolved = false,
          ) =>
            prisma.healthcareEquipmentRequirementCoverageNote.create({
              data: {
                id: randomUUID(),
                companyId: owner.id,
                requirementId,
                kind: 'UNAVAILABLE',
                comment: 'C5AVL owned context',
                recordedById: owner.userId,
                createdAt: audit,
                ...(resolved
                  ? { resolvedAt: audit, resolvedById: owner.userId }
                  : {}),
              },
            });
          await checkBoundary();
          const caseA = await createCase(a);
          const caseB = await createCase(b);
          const absentCase = await createCase(a, true);
          const uncertainCase = await createCase(a);
          const conflictCase = await createCase(a);
          const blockedCase = await createCase(a);
          const covered = await requirement(a, caseA.id, 1);
          const partial = await requirement(a, caseA.id, 2, 'BACKUP');
          const pending = await requirement(a, caseA.id, 1, 'BACKUP');
          const unavailable = await requirement(a, caseA.id, 1, 'BACKUP');
          const quantity = await requirement(
            a,
            caseA.id,
            2,
            'REQUIRED',
            'QUANTITY',
          );
          await requirement(a, caseA.id, 99, 'REQUIRED', 'ASSET', true);
          const blocked = await requirement(a, blockedCase.id, 2);
          const foreignQuantity = await requirement(
            b,
            caseB.id,
            1,
            'REQUIRED',
            'QUANTITY',
          );
          const foreignAsset = await requirement(b, caseB.id, 1, 'BACKUP');
          await note(a, unavailable.id);
          await note(a, unavailable.id, true);
          await note(a, pending.id, true);
          await note(b, foreignAsset.id);
          const coveredAssignment = await assignment(
            a,
            caseA.id,
            (await asset(a, covered.productId)).id,
            covered.id,
          );
          await assignment(
            a,
            caseA.id,
            (await asset(a, partial.productId)).id,
            partial.id,
          );
          // Same Product as PARTIAL: DIRECT must affect diagnostics, never quantity.
          const directAsset = await asset(a, partial.productId);
          const direct = await assignment(a, caseA.id, directAsset.id, null);
          const conflict = await assignment(
            a,
            conflictCase.id,
            directAsset.id,
            null,
          );
          await assignment(
            a,
            caseA.id,
            (await asset(a, partial.productId)).id,
            partial.id,
            'RELEASED',
          );
          await assignment(
            a,
            caseA.id,
            (await asset(a, partial.productId)).id,
            partial.id,
            'REPLACED',
          );
          const uncertainAsset = await asset(a, partial.productId);
          await assignment(a, uncertainCase.id, uncertainAsset.id, null);
          await assignment(a, absentCase.id, uncertainAsset.id, null);
          const blockedAssignment = await assignment(
            a,
            blockedCase.id,
            (await asset(a, blocked.productId)).id,
            blocked.id,
          );
          await assignment(
            b,
            caseB.id,
            (await asset(b, foreignAsset.productId)).id,
            null,
          );
          const settings =
            await prisma.healthcareEquipmentAssignmentSettings.findUnique({
              where: { companyId: a.id },
            });
          const window = deriveEquipmentAssignmentOperationalWindow(
            caseA,
            resolveEquipmentAssignmentBuffers(settings),
          );
          if (!window)
            throw new Error('C5AVL complete fixture window required');
          await prisma.healthcareEquipmentAssignmentConflictOverride.create({
            data: {
              id: randomUUID(),
              companyId: a.id,
              assignmentId: direct.id,
              conflictingAssignmentId: conflict.id,
              approvedById: a.userId,
              reason: 'C5AVL owned exact conflict override',
              assignmentWindowStart: window.start,
              assignmentWindowEnd: window.end,
              conflictingWindowStart: window.start,
              conflictingWindowEnd: window.end,
            },
          });
          const kitA = randomUUID();
          const blockedKit = randomUUID();
          await control.createCaseKit({
            id: kitA,
            companyId: a.id,
            caseId: caseA.id,
            status: 'PREPARED',
            items: [
              { id: randomUUID(), equipmentAssignmentId: coveredAssignment.id },
              {
                id: randomUUID(),
                requirementId: quantity.id,
                preparedQuantity: 2,
              },
              {
                id: randomUUID(),
                requirementId: quantity.id,
                preparedQuantity: 1,
                excluded: true,
              },
            ],
          });
          await control.createCaseKit({
            id: blockedKit,
            companyId: a.id,
            caseId: blockedCase.id,
            items: [
              { id: randomUUID(), equipmentAssignmentId: blockedAssignment.id },
            ],
          });
          await control.createCaseKit({
            id: randomUUID(),
            companyId: b.id,
            caseId: caseB.id,
            items: [
              {
                id: randomUUID(),
                requirementId: foreignQuantity.id,
                preparedQuantity: 1,
              },
            ],
          });
          const jwt = app.get(JwtService);
          const roleTokens: string[] = [];
          for (const role of [
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.SALES,
            UserRole.WAREHOUSE,
          ]) {
            const user = await prisma.user.create({
              data: {
                id: randomUUID(),
                companyId: a.id,
                email: `c5avl-${randomUUID()}@example.test`,
                passwordHash: 'not-a-login-credential',
                firstName: 'Reader',
                lastName: role,
                role,
              },
            });
            roleTokens.push(
              jwt.sign({
                sub: user.id,
                companyId: a.id,
                email: user.email,
                role,
                authVersion: user.authVersion,
              }),
            );
          }
          const foreignUser = await prisma.user.findUniqueOrThrow({
            where: { id: b.userId },
          });
          const foreignToken = jwt.sign({
            sub: foreignUser.id,
            companyId: b.id,
            email: foreignUser.email,
            role: foreignUser.role,
            authVersion: foreignUser.authVersion,
          });
          // Capture every scalar field in every relevant owned row, including
          // audit timestamps and row identities. No fixture writes follow this point.
          const snapshot = () =>
            prisma.$transaction(
              async (tx) => {
                const where = { companyId: { in: companyIds } };
                const orderBy = { id: 'asc' as const };
                return {
                  cases: await tx.healthcareCase.findMany({ where, orderBy }),
                  requirements: await tx.healthcareCaseRequirement.findMany({
                    where,
                    orderBy,
                  }),
                  assignments: await tx.healthcareEquipmentAssignment.findMany({
                    where,
                    orderBy,
                  }),
                  overrides:
                    await tx.healthcareEquipmentAssignmentConflictOverride.findMany(
                      { where, orderBy },
                    ),
                  notes:
                    await tx.healthcareEquipmentRequirementCoverageNote.findMany(
                      { where, orderBy },
                    ),
                  kits: await tx.healthcareCaseKit.findMany({ where, orderBy }),
                  items: await tx.healthcareCaseKitItem.findMany({
                    where,
                    orderBy,
                  }),
                  assets: await tx.equipmentAsset.findMany({ where, orderBy }),
                  products: await tx.product.findMany({ where, orderBy }), // Inventory = Product.stock in this schema.
                  idempotency: await tx.idempotencyRecord.findMany({
                    where,
                    orderBy,
                  }),
                  settings:
                    await tx.healthcareEquipmentAssignmentSettings.findMany({
                      where,
                      orderBy: { companyId: 'asc' },
                    }),
                };
              },
              {
                isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
              },
            );
          type Availability = {
            caseId: string;
            caseStatus: string;
            schedule: {
              scheduledStart: string | null;
              scheduledEnd: string | null;
              complete: boolean;
              warnings: { code: string }[];
            };
            requirements: {
              activeCount: number;
              requiredCount: number;
              backupCount: number;
            };
            coverage: {
              requirementCount: number;
              coveredCount: number;
              partialCount: number;
              pendingCount: number;
              unavailableCount: number;
              activeNoteCount: number;
            };
            equipment: {
              reservedAssignmentCount: number;
              fullyVerifiable: boolean;
              conflictFree: boolean | null;
              warnings: { code: string }[];
            };
            preparation: {
              caseKitId: string | null;
              status: string | null;
              readiness: {
                status: string;
                blockers: { code: string; requirementId?: string }[];
              } | null;
            };
          };
          const get = (id: string, bearer = token) =>
            supertest(app.getHttpServer())
              .get(`/healthcare/cases/${id}/availability`)
              .set('Authorization', `Bearer ${bearer}`);
          await checkBoundary();
          const before = await snapshot();
          const inventoryBefore = await control.observeInventory();
          const result = (await get(caseA.id).expect(200)).body as Availability;
          expect(Object.keys(result).sort()).toEqual([
            'caseId',
            'caseStatus',
            'coverage',
            'equipment',
            'preparation',
            'requirements',
            'schedule',
          ]);
          expect(result).toMatchObject({
            caseId: caseA.id,
            caseStatus: 'SCHEDULED',
            schedule: {
              complete: true,
              scheduledStart: start.toISOString(),
              scheduledEnd: end.toISOString(),
              warnings: [],
            },
            requirements: { activeCount: 5, requiredCount: 2, backupCount: 3 },
            coverage: {
              requirementCount: 4,
              coveredCount: 1,
              partialCount: 1,
              pendingCount: 1,
              unavailableCount: 1,
              activeNoteCount: 1,
            },
            equipment: {
              reservedAssignmentCount: 3,
              fullyVerifiable: true,
              conflictFree: false,
            },
            preparation: {
              caseKitId: kitA,
              status: 'PREPARED',
              readiness: { status: 'PASS', blockers: [] },
            },
          });
          expect(
            result.equipment.warnings.map((warning) => warning.code),
          ).toEqual([
            'CURRENT_ASSIGNMENT_CONFLICT',
            'CONFLICT_OVERRIDE_CONFIRMED',
          ]);
          expect(JSON.stringify(result)).not.toMatch(
            /companyId|caseKitItemId|equipmentAssignmentId|createdById|preparedById|resolvedAt|assignmentWindowStart|lockKey/,
          );
          type CoverageRow = {
            requirementId: string;
            quantityState: string;
            assignedQty: number;
            activeNotes: unknown[];
          };
          const coverage = (
            await supertest(app.getHttpServer())
              .get(`/healthcare/cases/${caseA.id}/equipment-coverage`)
              .set('Authorization', `Bearer ${token}`)
              .expect(200)
          ).body as { items: CoverageRow[] };
          expect(
            coverage.items.find((row) => row.requirementId === partial.id),
          ).toMatchObject({ quantityState: 'PARTIAL', assignedQty: 1 });
          expect(result.coverage).toEqual({
            requirementCount: coverage.items.length,
            coveredCount: coverage.items.filter(
              (row) => row.quantityState === 'COVERED',
            ).length,
            partialCount: coverage.items.filter(
              (row) => row.quantityState === 'PARTIAL',
            ).length,
            pendingCount: coverage.items.filter(
              (row) => row.quantityState === 'PENDING',
            ).length,
            unavailableCount: coverage.items.filter(
              (row) => row.quantityState === 'UNAVAILABLE',
            ).length,
            activeNoteCount: coverage.items.reduce(
              (count, row) => count + row.activeNotes.length,
              0,
            ),
          });
          const absent = (await get(absentCase.id).expect(200))
            .body as Availability;
          expect(absent).toMatchObject({
            schedule: {
              complete: false,
              scheduledStart: null,
              scheduledEnd: null,
            },
            requirements: { activeCount: 0, requiredCount: 0, backupCount: 0 },
            coverage: {
              requirementCount: 0,
              coveredCount: 0,
              partialCount: 0,
              pendingCount: 0,
              unavailableCount: 0,
              activeNoteCount: 0,
            },
            equipment: {
              reservedAssignmentCount: 1,
              fullyVerifiable: false,
              conflictFree: null,
            },
            preparation: { caseKitId: null, status: null, readiness: null },
          });
          expect(
            absent.schedule.warnings.map((warning) => warning.code),
          ).toEqual(['INCOMPLETE_CASE_SCHEDULE']);
          expect(
            absent.equipment.warnings.map((warning) => warning.code),
          ).toEqual(['INCOMPLETE_CASE_SCHEDULE']);
          const uncertain = (await get(uncertainCase.id).expect(200))
            .body as Availability;
          expect(uncertain.equipment).toMatchObject({
            reservedAssignmentCount: 1,
            fullyVerifiable: false,
            conflictFree: null,
          });
          expect(
            uncertain.equipment.warnings.map((warning) => warning.code),
          ).toEqual(['RELATED_RESERVATION_SCHEDULE_INCOMPLETE']);
          const blockedRead = (await get(blockedCase.id).expect(200))
            .body as Availability;
          expect(blockedRead.preparation).toEqual({
            caseKitId: blockedKit,
            status: 'DRAFT',
            readiness: {
              status: 'BLOCKED',
              blockers: [
                {
                  code: 'CASE_KIT_REQUIRED_ASSET_NOT_COVERED',
                  requirementId: blocked.id,
                },
              ],
            },
          });
          const empty = (await get(conflictCase.id).expect(200))
            .body as Availability;
          expect(empty.requirements.activeCount).toBe(0);
          expect(empty.preparation).toEqual({
            caseKitId: null,
            status: null,
            readiness: null,
          });
          const foreignRead = (await get(caseB.id, foreignToken).expect(200))
            .body as Availability;
          expect(foreignRead.requirements).toEqual({
            activeCount: 2,
            requiredCount: 1,
            backupCount: 1,
          });
          expect(foreignRead.coverage).toEqual({
            requirementCount: 1,
            coveredCount: 0,
            partialCount: 0,
            pendingCount: 0,
            unavailableCount: 1,
            activeNoteCount: 1,
          });
          expect(foreignRead.equipment).toEqual({
            reservedAssignmentCount: 1,
            fullyVerifiable: true,
            conflictFree: true,
            warnings: [],
          });
          expect(foreignRead.preparation.readiness).toEqual({
            status: 'PASS',
            blockers: [],
          });
          for (const roleToken of roleTokens) {
            expect((await get(caseA.id, roleToken).expect(200)).body).toEqual(
              result,
            );
          }
          await supertest(app.getHttpServer())
            .get(`/healthcare/cases/${caseA.id}/availability`)
            .expect(401);
          const missing = await get(randomUUID()).expect(404);
          expect((await get(caseB.id).expect(404)).body).toEqual(missing.body);
          expect((await get(caseA.id, foreignToken).expect(404)).body).toEqual(
            missing.body,
          );
          const spoofed = await get(caseA.id)
            .query({ companyId: b.id })
            .set('x-company-id', b.id)
            .expect(200);
          expect(spoofed.body).toEqual(result);
          await get('invalid').expect(400);
          expect(await snapshot()).toEqual(before);
          expect(await control.observeInventory()).toEqual(inventoryBefore);
          await checkBoundary();
        },
        { control: true },
      );
    }, 120000);
  },
);
