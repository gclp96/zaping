import { Module } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { EquipmentController } from './equipment.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [EquipmentController],
  providers: [EquipmentService, PrismaService],
})
export class EquipmentModule {}
