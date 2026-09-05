import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { EquipmentCondition } from '@prisma/client';

import { CreateEquipmentDto } from './create-equipment.dto';

describe('CreateEquipmentDto', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformDto = (value: Record<string, unknown>) =>
    validationPipe.transform(value, {
      type: 'body',
      metatype: CreateEquipmentDto,
    });

  it('should not require assetCode for normal equipment creation', async () => {
    await expect(
      transformDto({
        productId: '953a950f-b33a-4ff5-85ac-4ff35b8f3017',
        condition: EquipmentCondition.GOOD,
      }),
    ).resolves.toMatchObject({
      productId: '953a950f-b33a-4ff5-85ac-4ff35b8f3017',
      condition: EquipmentCondition.GOOD,
    });
  });

  it('should reject client-provided assetCode as a non-whitelisted field', async () => {
    await expect(
      transformDto({
        productId: '953a950f-b33a-4ff5-85ac-4ff35b8f3017',
        condition: EquipmentCondition.GOOD,
        assetCode: 'CUSTOM-001',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
