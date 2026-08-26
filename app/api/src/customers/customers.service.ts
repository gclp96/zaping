import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(companyId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        companyId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return customer;
  }

  findAll(companyId: string) {
    return this.prisma.customer.findMany({
      where: {
        companyId,
        isActive: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  create(companyId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        companyId,
        name: dto.name,
        type: dto.type,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        contactName: dto.contactName,
        notes: dto.notes,
      },
    });
  }

  async update(companyId: string, customerId: string, dto: UpdateCustomerDto) {
    const customer = await this.findOne(companyId, customerId);
    const data = {
      name: dto.name,
      type: dto.type,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      contactName: dto.contactName,
      notes: dto.notes,
    };

    if (Object.values(data).every((value) => value === undefined)) {
      return customer;
    }

    const result = await this.prisma.customer.updateMany({
      where: {
        id: customerId,
        companyId,
      },
      data,
    });

    if (result.count !== 1) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return this.findOne(companyId, customerId);
  }

  async remove(companyId: string, customerId: string) {
    const customer = await this.findOne(companyId, customerId);

    if (!customer.isActive) {
      return customer;
    }

    await this.prisma.customer.updateMany({
      where: {
        id: customerId,
        companyId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    return this.findOne(companyId, customerId);
  }
}
