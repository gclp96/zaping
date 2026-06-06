import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

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

  update(companyId: string, id: string, dto: UpdateCustomerDto) {
    return this.prisma.customer.update({
      where: {
        id,
      },

      data: dto,
    });
  }

  remove(companyId: string, customerId: string) {
    return this.prisma.customer.delete({
      where: {
        id: customerId,
      },
    });
  }
}
