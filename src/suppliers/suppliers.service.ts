import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.supplier.findMany({
      where: {
        companyId,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(companyId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        companyId,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    return supplier;
  }

  async create(companyId: string, dto: CreateSupplierDto) {
    const existingSupplier = await this.prisma.supplier.findFirst({
      where: {
        companyId,
        name: dto.name,
      },
    });

    if (existingSupplier) {
      throw new BadRequestException('Ya existe un proveedor con ese nombre');
    }

    return this.prisma.supplier.create({
      data: {
        companyId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        contactName: dto.contactName,
        notes: dto.notes,
      },
    });
  }

  async update(companyId: string, supplierId: string, dto: UpdateSupplierDto) {
    await this.findOne(companyId, supplierId);

    return this.prisma.supplier.update({
      where: {
        id: supplierId,
      },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        contactName: dto.contactName,
        notes: dto.notes,
      },
    });
  }

  async remove(companyId: string, supplierId: string) {
    await this.findOne(companyId, supplierId);

    return this.prisma.supplier.delete({
      where: {
        id: supplierId,
      },
    });
  }
}
