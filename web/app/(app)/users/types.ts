import type { UserRole } from "@/app/auth-session";

export type { UserRole };

export type User = {
  id: string;
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateUserPayload = {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  password: string;
};

export type UpdateUserPayload = {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
};
