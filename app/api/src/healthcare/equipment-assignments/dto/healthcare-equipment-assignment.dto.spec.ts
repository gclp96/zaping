import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { HealthcareEquipmentAssignmentOrigin } from '@prisma/client';

import { CreateHealthcareEquipmentAssignmentDto } from './create-healthcare-equipment-assignment.dto';
import {
  HealthcareEquipmentAssignmentListQueryDto,
  HealthcareEquipmentAssignmentListStatus,
} from './healthcare-equipment-assignment-list-query.dto';

describe('Healthcare Equipment Assignment DTOs', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const caseId = '11111111-1111-4111-8111-111111111111';
  const equipmentAssetId = '22222222-2222-4222-8222-222222222222';
  const requirementId = '33333333-3333-4333-8333-333333333333';

  const transformBody = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'body',
      metatype: CreateHealthcareEquipmentAssignmentDto,
    });

  const transformQuery = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'query',
      metatype: HealthcareEquipmentAssignmentListQueryDto,
    });

  it('accepts the REQUIREMENT create allowlist', async () => {
    await expect(
      transformBody({ caseId, equipmentAssetId, requirementId }),
    ).resolves.toMatchObject({ caseId, equipmentAssetId, requirementId });
  });

  it('normalizes the DIRECT reason without accepting workflow fields', async () => {
    await expect(
      transformBody({
        caseId,
        equipmentAssetId,
        requirementId: null,
        directAssignmentReason: '  Respaldo   urgente  ',
      }),
    ).resolves.toMatchObject({
      caseId,
      equipmentAssetId,
      requirementId: null,
      directAssignmentReason: 'Respaldo   urgente',
    });
  });

  it.each([
    {},
    { caseId: 'invalid', equipmentAssetId },
    { caseId, equipmentAssetId: 'invalid' },
    { caseId, equipmentAssetId, requirementId: 'invalid' },
    {
      caseId,
      equipmentAssetId,
      directAssignmentReason: 'x'.repeat(1001),
    },
  ])('rejects malformed create payload %#', async (payload) => {
    await expect(transformBody(payload)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each([
    'id',
    'companyId',
    'origin',
    'status',
    'lifecycle',
    'createdById',
    'assignedAt',
    'releasedAt',
    'replacesAssignmentId',
    'confirmConflictOverride',
    'conflictReviewFingerprint',
    'conflictOverrideReason',
  ])('rejects protected or C3 create field %s', async (field) => {
    await expect(
      transformBody({
        caseId,
        equipmentAssetId,
        directAssignmentReason: 'Urgencia',
        [field]: 'protected',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies list defaults and transforms pagination', async () => {
    await expect(transformQuery({})).resolves.toMatchObject({
      page: 1,
      pageSize: 25,
      status: HealthcareEquipmentAssignmentListStatus.RESERVED,
    });
    await expect(
      transformQuery({
        caseId,
        requirementId,
        equipmentAssetId,
        status: HealthcareEquipmentAssignmentListStatus.ALL,
        origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
        page: '2',
        pageSize: '100',
      }),
    ).resolves.toMatchObject({
      page: 2,
      pageSize: 100,
      status: HealthcareEquipmentAssignmentListStatus.ALL,
      origin: HealthcareEquipmentAssignmentOrigin.DIRECT,
    });
  });

  it.each([
    { page: '0' },
    { page: '1.5' },
    { pageSize: '0' },
    { pageSize: '101' },
    { status: 'PENDING' },
    { origin: 'OTHER' },
    { caseId: 'invalid' },
    { companyId: caseId },
    { sort: 'createdAt' },
  ])('rejects invalid or unexpected list query %#', async (query) => {
    await expect(transformQuery(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
