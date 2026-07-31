import { UserRole } from '@prisma/client';
import { Request } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
