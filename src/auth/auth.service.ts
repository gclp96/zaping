import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(data: {
    companyName: string;
    tradeName?: string;
    rfc: string;

    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const company = await this.prisma.company.create({
      data: {
        name: data.companyName,
        tradeName: data.tradeName,
        rfc: data.rfc,
      },
    });

    const user = await this.prisma.user.create({
      data: {
        companyId: company.id,

        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,

        passwordHash: hashedPassword,

        role: 'SUPER_ADMIN',
      },
    });

    const token = await this.jwtService.signAsync({
      sub: user.id,
      companyId: company.id,
      email: user.email,
      role: user.role,
    });

    return {
      token,
      company,
      user,
    };
  }

  async login(data: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: data.email,
      },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(
      data.password,
      user.passwordHash,
    );

    if (!passwordValid) {
      throw new Error('Invalid credentials');
    }

    const token = await this.jwtService.signAsync({
      sub: user.id,
      companyId: user.companyId,
      email: user.email,
      role: user.role,
    });

    return {
      token,
      user,
    };
  }
}
