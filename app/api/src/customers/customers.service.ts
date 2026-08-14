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
    await this.findOne(companyId, customerId);

    return this.prisma.customer.update({
      where: {
        id: customerId,
      },
      data: dto,
    });
  }

  async remove(companyId: string, customerId: string) {
    await this.findOne(companyId, customerId);

    return this.prisma.customer.delete({
      where: {
        id: customerId,
      },
    });
  }
}
