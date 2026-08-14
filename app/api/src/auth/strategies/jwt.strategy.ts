import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthenticatedUser } from '../interfaces/authenticated-request.interface';

interface JwtPayload {
  sub: string;
  companyId: string;
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error('JWT_SECRET must be defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload.sub || !payload.companyId || !payload.email || !payload.role) {
      throw new UnauthorizedException('Token inválido');
    }

    return {
      id: payload.sub,
      companyId: payload.companyId,
      email: payload.email,
      firstName: payload.firstName ?? '',
      lastName: payload.lastName ?? '',
      role: payload.role,
    };
  }
}
