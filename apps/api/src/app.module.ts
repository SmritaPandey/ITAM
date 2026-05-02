import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './common/database/prisma.module';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { AssetsModule } from './modules/assets/assets.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { LicensesModule } from './modules/licenses/licenses.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AutomationModule } from './modules/automation/automation.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SettingsModule } from './modules/settings/settings.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { PatchesModule } from './modules/patches/patches.module';
import { AssetTypesModule } from './modules/asset-types/asset-types.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { ServiceCatalogModule } from './modules/service-catalog/service-catalog.module';
import { HealthModule } from './modules/health/health.module';
import { EventBusModule } from './common/events/event-bus.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';
import { SetupModule } from './modules/setup/setup.module';
import { WorkOrdersModule } from './modules/work-orders/work-orders.module';
import { ScanningModule } from './modules/scanning/scanning.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { ChangesModule } from './modules/changes/changes.module';
import { ProblemsModule } from './modules/problems/problems.module';
import { ComplianceModule } from './modules/compliance/compliance.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // Scheduled tasks
    ScheduleModule.forRoot(),

    // Database
    PrismaModule,

    // Event Bus (global)
    EventBusModule,

    // Feature modules
    AuthModule,
    UsersModule,
    TenantsModule,
    AssetsModule,
    TicketsModule,
    DiscoveryModule,
    LicensesModule,
    AuditLogsModule,
    NotificationsModule,
    AutomationModule,
    ReportsModule,
    SettingsModule,
    MonitoringModule,
    PatchesModule,
    AssetTypesModule,
    FleetModule,
    ServiceCatalogModule,
    KnowledgeBaseModule,
    SetupModule,
    WorkOrdersModule,
    ScanningModule,
    ProcurementModule,
    ChangesModule,
    ProblemsModule,
    ComplianceModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule {}
