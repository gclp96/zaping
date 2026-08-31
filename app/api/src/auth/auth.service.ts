import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuthenticatedSession,
  AuthenticatedUser,
} from './interfaces/authenticated-request.interface';

import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async getAuthenticatedUserContext(
    user: AuthenticatedUser,
  ): Promise<AuthenticatedSession> {
    const company = await this.prisma.company.findUnique({
      where: {
        id: user.companyId,
      },
      select: {
        timezone: true,
      },
    });

    if (!company) {
      throw new UnauthorizedException('Token inválido');
    }

    return {
      ...user,
      companyTimezone: company.timezone,
    };
  }

  async register(data: {
    companyName: string;
    tradeName?: string;
    rfc: string;

    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) {
    if (
      !data.companyName ||
      !data.rfc ||
      !data.firstName ||
      !data.lastName ||
      !data.email ||
      !data.password
    ) {
      throw new BadRequestException('Faltan campos obligatorios');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    const existingCompany = await this.prisma.company.findUnique({
      where: { rfc: data.rfc },
    });

    if (existingCompany) {
      throw new ConflictException('Ya existe una empresa con ese RFC');
    }

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

        role: 'ADMIN',
      },
    });

    const token = await this.jwtService.signAsync({
      sub: user.id,
      companyId: company.id,
      email: user.email,
      role: user.role,
    });

    const safeUser = {
      id: user.id,
      companyId: user.companyId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      locale: user.locale,
    };

    return {
      token,
      company,
      user: safeUser,
    };
  }

  async login(data: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: data.email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValid = await bcrypt.compare(
      data.password,
      user.passwordHash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const token = await this.jwtService.signAsync({
      sub: user.id,
      companyId: user.companyId,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    const safeUser = {
      id: user.id,
      companyId: user.companyId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      locale: user.locale,
    };

    return {
      token,
      user: safeUser,
    };
  }
}
