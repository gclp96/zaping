import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { CompaniesModule } from './companies/companies.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { QuotesModule } from './quotes/quotes.module';
import { PurchasesModule } from './purchases/purchases.module';
import { SalesModule } from './sales/sales.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { CategoriesModule } from './categories/categories.module';
import { UsersModule } from './users/users.module';
import { PurchaseReceiptsModule } from './purchases-receipts/purchases-receipts.module';
import { EquipmentModule } from './equipment/equipment.module';
import { HealthcareCasesModule } from './healthcare/cases/healthcare-cases.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { validateEnvironment } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    CustomersModule,
    ProductsModule,
    InventoryModule,
    CompaniesModule,
    DashboardModule,
    QuotesModule,
    PurchasesModule,
    PurchaseReceiptsModule,
    SalesModule,
    SuppliersModule,
    CategoriesModule,
    UsersModule,
    EquipmentModule,
    HealthcareCasesModule,
  ],
})
export class AppModule {}
