import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { DashboardService } from './dashboard.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guards';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES, UserRole.WAREHOUSE)
  @Get()
  getDashboard(@Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.dashboardService.get(req.user.companyId);
  }
}
