// PREPARED ONLY. Requires separately reviewed migration + column ACL first.
// No imports or client construction when opt-in is disabled.
const coverageNotesEnabled = process.env.RUN_HC_C5B_POSTGRES_TESTS === '1';
(coverageNotesEnabled ? describe : describe.skip)(
  'HC-NEXT-03C5-COVERAGE-N HTTP/JWT persisted commands',
  () => {
    it('proves atomic notes, idempotency, concurrent duplicate requests, tenant/RBAC, audit and R readback', async () => {
      const { withC5bHarness } =
        await import('./helpers/healthcare-c5b-harness');
      const { randomUUID } = await import('node:crypto');
      const { JwtService } = await import('@nestjs/jwt');
      const { default: supertest } = await import('supertest');
      const { HealthcareEquipmentAssignmentsRepository } =
        await import('../src/healthcare/equipment-assignments/healthcare-equipment-assignments.repository');
      await withC5bHarness(
        async ({ prisma, app, owners, token, checkBoundary, control }) => {
          if (!control) throw new Error('C5B control required');
          const [owner, foreign] = owners;
          const ids = owners.map((o) => o.id);
          const jwt = app.get(JwtService);
          const http = supertest(app.getHttpServer());
          const audit = new Date('2026-10-09T00:00:00.000Z');
          async function actor(
            role: 'MANAGER' | 'WAREHOUSE' | 'SALES',
            companyId = owner.id,
          ) {
            const id = randomUUID();
            const user = await prisma.user.create({
              data: {
                id,
                companyId,
                email: `c5n-${id}@example.invalid`,
                passwordHash: 'not-a-login-credential',
                firstName: 'Owned',
                lastName: role,
                role,
                isActive: true,
                authVersion: 0,
              },
            });
            return {
              id,
              token: jwt.sign({
                sub: id,
                companyId,
                email: user.email,
                role,
                authVersion: 0,
              }),
            };
          }
          const manager = await actor('MANAGER');
          const warehouse = await actor('WAREHOUSE');
          const sales = await actor('SALES');
          const tenantB = await actor('MANAGER', foreign.id);
          async function fixture(
            count = 0,
            qty = 2,
            cancelled = false,
            retired = false,
            ownerFixture = owner,
          ) {
            const caseId = randomUUID();
            const productId = randomUUID();
            const requirementId = randomUUID();
            await prisma.healthcareCase.create({
              data: {
                id: caseId,
                companyId: ownerFixture.id,
                folio: `C5N-${caseId}`,
                title: 'Owned N acceptance',
                createdById: ownerFixture.userId,
                status: cancelled ? 'CANCELLED' : 'DRAFT',
              },
            });
            await prisma.product.create({
              data: {
                id: productId,
                companyId: ownerFixture.id,
                sku: `C5N-${productId}`,
                name: 'Owned N equipment',
                inventoryTracking: 'ASSET',
              },
            });
            await prisma.healthcareCaseRequirement.create({
              data: {
                id: requirementId,
                companyId: ownerFixture.id,
                caseId,
                productId,
                requestedQty: qty,
                sortOrder: 1,
                type: 'REQUIRED',
                createdById: ownerFixture.userId,
                ...(retired
                  ? {
                      lifecycle: 'RETIRED',
                      retiredAt: audit,
                      retiredById: ownerFixture.userId,
                      retirementReason: 'Owned retired fixture',
                    }
                  : {}),
              },
            });
            for (let n = 0; n < count; n++) {
              const assetId = randomUUID();
              await prisma.equipmentAsset.create({
                data: {
                  id: assetId,
                  companyId: ownerFixture.id,
                  productId,
                  assetCode: `C5N-${assetId}`,
                  lifecycle: 'ACTIVE',
                  condition: 'GOOD',
                },
              });
              await prisma.healthcareEquipmentAssignment.create({
                data: {
                  companyId: ownerFixture.id,
                  caseId,
                  requirementId,
                  equipmentAssetId: assetId,
                  origin: 'REQUIREMENT',
                  createdById: ownerFixture.userId,
                },
              });
            }
            return {
              caseId,
              requirementId,
              path: `/healthcare/cases/${caseId}/requirements/${requirementId}/equipment-coverage-notes`,
            };
          }
          await checkBoundary();
          const zero = await fixture();
          const partial = await fixture(1);
          const sufficient = await fixture(2);
          const cancelled = await fixture(0, 2, true);
          const retired = await fixture(0, 2, false, true);
          const foreignFixture = await fixture(0, 2, false, false, foreign);
          const race = await fixture();
          const rollback = await fixture();
          const cancelReplay = await fixture();
          const retireReplay = await fixture();
          const snapshot = async () => ({
            assignments: await prisma.healthcareEquipmentAssignment.findMany({
              where: { companyId: { in: ids } },
              orderBy: { id: 'asc' },
            }),
            overrides:
              await prisma.healthcareEquipmentAssignmentConflictOverride.findMany(
                { where: { companyId: { in: ids } }, orderBy: { id: 'asc' } },
              ),
            assets: await prisma.equipmentAsset.findMany({
              where: { companyId: { in: ids } },
              orderBy: { id: 'asc' },
            }),
            products: await prisma.product.findMany({
              where: { companyId: { in: ids } },
              orderBy: { id: 'asc' },
            }),
          });
          // Inventory/Purchase/Sale/CaseKit access remains prohibited by exact ACL.
          const physicalBefore = await snapshot();
          const post = (
            path: string,
            key: string,
            body: object = {},
            bearer = token,
          ) =>
            http
              .post(path)
              .set('Authorization', `Bearer ${bearer}`)
              .set('Idempotency-Key', key)
              .timeout({ response: 10000, deadline: 15000 })
              .send(body);
          const body = { kind: 'UNAVAILABLE', comment: ' No equipment ' };
          const created = await post(zero.path, 'create', body).expect(201);
          const original = created.body as {
            id: string;
            resolvedAt: string | null;
            recordedBy: { id: string };
          };
          expect(original.recordedBy.id).toBe(owner.userId);
          expect(original).not.toHaveProperty('companyId');
          expect(original).not.toHaveProperty('claims');
          expect(
            (
              await post(
                zero.path,
                'create',
                { ...body, comment: 'No equipment' },
                manager.token,
              ).expect(201)
            ).body,
          ).toEqual(original);
          await post(zero.path, 'create', { ...body, comment: 'Other' }).expect(
            409,
          );
          const rejectWithoutWrites = async (
            path: string,
            key: string,
            data: object,
            expectedCode?: string,
          ) => {
            const before =
              await prisma.healthcareEquipmentRequirementCoverageNote.count({
                where: { companyId: owner.id },
              });
            const rejected = await post(path, key, data).expect(409);
            if (expectedCode)
              expect((rejected.body as { code: string }).code).toBe(
                expectedCode,
              );
            expect(
              await prisma.healthcareEquipmentRequirementCoverageNote.count({
                where: { companyId: owner.id },
              }),
            ).toBe(before);
            expect(
              await prisma.idempotencyRecord.count({
                where: { companyId: owner.id, key },
              }),
            ).toBe(0);
          };
          await rejectWithoutWrites(partial.path, 'unavailable-positive', body);
          await rejectWithoutWrites(
            sufficient.path,
            'unavailable-sufficient',
            body,
          );
          await rejectWithoutWrites(zero.path, 'partial-zero', {
            kind: 'PARTIAL_CONTEXT',
            comment: 'Partial',
          });
          await rejectWithoutWrites(sufficient.path, 'partial-sufficient', {
            kind: 'PARTIAL_CONTEXT',
            comment: 'Partial',
          });
          await rejectWithoutWrites(cancelled.path, 'cancelled', body);
          await rejectWithoutWrites(retired.path, 'retired', body);
          await post(
            partial.path,
            'partial',
            { kind: 'PARTIAL_CONTEXT', comment: 'Partial' },
            manager.token,
          ).expect(201);
          await post(zero.path, 'sales', body, sales.token).expect(403);
          await http.post(zero.path).send(body).expect(401);
          const forbidden = await post(
            zero.path,
            'foreign',
            body,
            tenantB.token,
          ).expect(404);
          const missing = await post(
            zero.path.replace(zero.caseId, randomUUID()),
            'missing',
            body,
          ).expect(404);
          expect(forbidden.body).toEqual(missing.body);
          const relationship = await post(
            zero.path.replace(zero.requirementId, partial.requirementId),
            'bad-relation',
            body,
          ).expect(404);
          expect(relationship.body).toEqual(missing.body);
          await post(foreignFixture.path, 'create', body, tenantB.token).expect(
            201,
          ); // same key, distinct tenant
          // Both application PIDs must wait on the exact production Company lock.
          const raced = await control.contend(owner.id, [
            () =>
              post(race.path, 'race-1', body, warehouse.token).then((r) => r),
            () =>
              post(race.path, 'race-2', body, warehouse.token).then((r) => r),
          ]);
          expect(raced.map((r) => r.status).sort()).toEqual([201, 409]);
          expect(
            await prisma.healthcareEquipmentRequirementCoverageNote.count({
              where: {
                companyId: owner.id,
                requirementId: race.requirementId,
                resolvedAt: null,
              },
            }),
          ).toBe(1);
          const winnerIndex = raced[0].status === 201 ? 0 : 1;
          const winningNote = raced[winnerIndex].body as { id: string };
          expect(
            await prisma.idempotencyRecord.findFirst({
              where: {
                companyId: owner.id,
                key: winnerIndex === 0 ? 'race-1' : 'race-2',
                scope: 'HEALTHCARE_EQUIPMENT_COVERAGE_NOTE_CREATE',
              },
            }),
          ).toMatchObject({ resourceId: winningNote.id });
          expect((raced[1 - winnerIndex].body as { code: string }).code).toBe(
            'RESOURCE_STATE_CHANGED',
          );
          const loser = raced[0].status === 409 ? 'race-1' : 'race-2';
          expect(
            await prisma.idempotencyRecord.count({
              where: { companyId: owner.id, key: loser },
            }),
          ).toBe(0);
          const route = `${zero.path}/${original.id}/resolve`;
          await post(route, 'sales-resolve', {}, sales.token).expect(403);
          await http.post(route).send({}).expect(401);
          const resolutions = await control.contend(owner.id, [
            () => post(route, 'resolve', {}, warehouse.token).then((r) => r),
            () =>
              post(route, 'resolve-concurrent', {}, manager.token).then(
                (r) => r,
              ),
          ]);
          expect(resolutions.map((r) => r.status)).toEqual([200, 200]);
          expect(resolutions[0].body).toEqual(resolutions[1].body);
          const resolved = resolutions[0];
          const first = resolved.body as {
            resolvedAt: string;
            resolvedBy: { id: string };
          };
          expect([warehouse.id, manager.id]).toContain(first.resolvedBy.id);
          expect(
            await prisma.healthcareEquipmentRequirementCoverageNote.findUniqueOrThrow(
              { where: { id: original.id } },
            ),
          ).toMatchObject({
            resolvedAt: new Date(first.resolvedAt),
            resolvedById: first.resolvedBy.id,
            recordedById: owner.userId,
          });
          expect(
            await prisma.idempotencyRecord.count({
              where: {
                companyId: owner.id,
                scope: 'HEALTHCARE_EQUIPMENT_COVERAGE_NOTE_RESOLVE',
                key: { in: ['resolve', 'resolve-concurrent'] },
                resourceId: original.id,
              },
            }),
          ).toBe(2);
          expect(first.resolvedAt).toBeTruthy();
          expect(
            (await post(route, 'resolve', {}, manager.token).expect(200)).body,
          ).toEqual(resolved.body);
          expect(
            (await post(route, 'new-resolve', {}, manager.token).expect(200))
              .body,
          ).toEqual(resolved.body);
          expect(
            (await post(zero.path, 'create', body).expect(201)).body,
          ).toEqual(original);
          const successor = await post(zero.path, 'successor', body).expect(
            201,
          );
          const successorId = (successor.body as { id: string }).id;
          await post(
            `${zero.path}/${successorId}/resolve`,
            'resolve',
            {},
          ).expect(409);
          await post(route, 'old-note-again', {}).expect(200);
          expect(
            (
              await prisma.healthcareEquipmentRequirementCoverageNote.findUniqueOrThrow(
                { where: { id: successorId } },
              )
            ).resolvedAt,
          ).toBeNull();
          const summary = await http
            .get(`/healthcare/cases/${zero.caseId}/equipment-coverage`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
          expect(
            (
              summary.body as {
                items: Array<{ activeNotes: Array<{ id: string }> }>;
              }
            ).items[0].activeNotes.map((n) => n.id),
          ).toEqual([successorId]);
          const history = await http
            .get(zero.path)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
          expect((history.body as { items: unknown[] }).items).toEqual(
            expect.arrayContaining([resolved.body, successor.body]),
          );
          for (const [parent, mode] of [
            [cancelReplay, 'cancel'],
            [retireReplay, 'retire'],
          ] as const) {
            const key = 'temporal-' + mode;
            const result = await post(parent.path, key, body).expect(201);
            const noteId = (result.body as { id: string }).id;
            const noteBefore =
              await prisma.healthcareEquipmentRequirementCoverageNote.findUniqueOrThrow(
                { where: { id: noteId } },
              );
            const claimBefore = await prisma.idempotencyRecord.findFirstOrThrow(
              {
                where: {
                  companyId: owner.id,
                  scope: 'HEALTHCARE_EQUIPMENT_COVERAGE_NOTE_CREATE',
                  key,
                },
              },
            );
            expect(claimBefore.resourceId).toBe(noteId);
            await control.transition(
              owner.id,
              parent.caseId,
              parent.requirementId,
              mode,
            );
            expect(
              (
                await post(
                  parent.path,
                  key,
                  { ...body, comment: 'No equipment' },
                  manager.token,
                ).expect(201)
              ).body,
            ).toEqual(result.body);
            expect(
              await prisma.healthcareEquipmentRequirementCoverageNote.count({
                where: {
                  companyId: owner.id,
                  requirementId: parent.requirementId,
                },
              }),
            ).toBe(1);
            expect(
              await prisma.idempotencyRecord.count({
                where: {
                  companyId: owner.id,
                  scope: 'HEALTHCARE_EQUIPMENT_COVERAGE_NOTE_CREATE',
                  key,
                },
              }),
            ).toBe(1);
            expect(
              await prisma.healthcareCase.findUniqueOrThrow({
                where: { id: parent.caseId },
              }),
            ).toMatchObject({
              status: mode === 'cancel' ? 'CANCELLED' : 'DRAFT',
            });
            expect(
              await prisma.healthcareCaseRequirement.findUniqueOrThrow({
                where: { id: parent.requirementId },
              }),
            ).toMatchObject({
              lifecycle: mode === 'retire' ? 'RETIRED' : 'ACTIVE',
            });
            await rejectWithoutWrites(
              parent.path,
              key + '-new',
              body,
              mode === 'cancel'
                ? 'CASE_REQUIREMENTS_READ_ONLY'
                : 'REQUIREMENT_RETIRED',
            );
            expect(
              await prisma.healthcareEquipmentRequirementCoverageNote.findUniqueOrThrow(
                { where: { id: noteId } },
              ),
            ).toEqual(noteBefore);
            expect(
              await prisma.idempotencyRecord.findUniqueOrThrow({
                where: { id: claimBefore.id },
              }),
            ).toEqual(claimBefore);
            const resolution = await post(
              parent.path + '/' + noteId + '/resolve',
              key + '-resolve',
              {},
              manager.token,
            ).expect(200);
            expect(
              (
                await post(
                  parent.path + '/' + noteId + '/resolve',
                  key + '-resolve',
                  {},
                  warehouse.token,
                ).expect(200)
              ).body,
            ).toEqual(resolution.body);
          }
          const wrongNote = await post(
            `${partial.path}/${original.id}/resolve`,
            'wrong-note',
            {},
          ).expect(404);
          expect(wrongNote.body).toEqual(missing.body);
          // Fail finalization after actual INSERT/UPDATE to prove database rollback.
          const repository = app.get(HealthcareEquipmentAssignmentsRepository);
          const failure = jest
            .spyOn(repository, 'completeIdempotencyClaim')
            .mockRejectedValueOnce(new Error('Injected finalization failure'));
          try {
            await post(rollback.path, 'rollback-create', body).expect(500);
          } finally {
            failure.mockRestore();
          }
          expect(
            await prisma.idempotencyRecord.count({
              where: { companyId: owner.id, key: 'rollback-create' },
            }),
          ).toBe(0);
          expect(
            await prisma.healthcareEquipmentRequirementCoverageNote.count({
              where: {
                companyId: owner.id,
                requirementId: rollback.requirementId,
              },
            }),
          ).toBe(0);
          const resolutionFailure = jest
            .spyOn(repository, 'completeIdempotencyClaim')
            .mockRejectedValueOnce(
              new Error('Injected resolution finalization failure'),
            );
          try {
            await post(
              `${zero.path}/${successorId}/resolve`,
              'rollback-resolve',
              {},
            ).expect(500);
          } finally {
            resolutionFailure.mockRestore();
          }
          expect(
            await prisma.idempotencyRecord.count({
              where: { companyId: owner.id, key: 'rollback-resolve' },
            }),
          ).toBe(0);
          expect(
            (
              await prisma.healthcareEquipmentRequirementCoverageNote.findUniqueOrThrow(
                { where: { id: successorId } },
              )
            ).resolvedAt,
          ).toBeNull();
          expect(await snapshot()).toEqual(physicalBefore);
          await checkBoundary();
          // Existing harness owns teardown and checks zero residue including claims/notes.
        },
        { control: true },
      );
    }, 120000);
  },
);
