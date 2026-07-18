import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/database/prisma.module';
import { ApiThrottlerGuard } from './common/guards/api-throttler.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { TenantRlsInterceptor } from './common/interceptors/tenant-rls.interceptor';
import { SecurityMiddleware } from './common/middleware/security.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { AssetsModule } from './modules/assets/assets.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { LicensesModule } from './modules/licenses/licenses.module';
import { SoftwareModule } from './modules/software/software.module';
import { RiskModule } from './modules/risk/risk.module';
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
import { QueueModule } from './common/queue/queue.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';
import { SetupModule } from './modules/setup/setup.module';
import { WorkOrdersModule } from './modules/work-orders/work-orders.module';
import { ScanningModule } from './modules/scanning/scanning.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { ChangesModule } from './modules/changes/changes.module';
import { ProblemsModule } from './modules/problems/problems.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { WebSocketModule } from './common/websocket/websocket.module';
import { ContactModule } from './modules/contact/contact.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AiModule } from './modules/ai/ai.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { VulnerabilitiesModule } from './modules/vulnerabilities/vulnerabilities.module';
import { IotModule } from './modules/iot/iot.module';
import { CloudConnectorsModule } from './modules/cloud-connectors/cloud-connectors.module';
import { SearchModule } from './modules/search/search.module';
import { EamModule } from './modules/eam/eam.module';
import { CmdbModule } from './modules/cmdb/cmdb.module';
import { ProductLicenseModule } from './modules/product-license/product-license.module';
import { ModuleGuard } from './common/guards/module.guard';
import { PrivacyModule } from './modules/privacy/privacy.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting (High performance for enterprise dashboard)
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 300 },    // 300 requests per second burst
      { name: 'medium', ttl: 10000, limit: 1500 }, // 1500 requests per 10 seconds
      { name: 'long', ttl: 60000, limit: 6000 },    // 6000 requests per minute
    ]),

    // Scheduled tasks (disabled via DISABLE_CRON_JOBS=true to save memory)
    ...(process.env.DISABLE_CRON_JOBS === 'true' ? [] : [ScheduleModule.forRoot()]),

    // Database
    PrismaModule,

    // Event Bus (global)
    EventBusModule,

    // Redis / BullMQ job queues
    QueueModule,

    // Product entitlement (SaaS issue + on-prem activate)
    ProductLicenseModule,

    // Feature modules
    AuthModule,
    UsersModule,
    TenantsModule,
    AssetsModule,
    TicketsModule,
    DiscoveryModule,
    LicensesModule,
    SoftwareModule,
    RiskModule,
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

    // Public modules
    ContactModule,

    // Platform admin
    AdminModule,

    // Analytics (first-party, consent-gated)
    AnalyticsModule,

    // AI Engine (Gemma 4)
    AiModule,
    PrivacyModule,

    // Real-time WebSocket
    WebSocketModule,

    // Alerting & Notifications
    AlertsModule,

    // Vulnerability / CVE engine (NVD)
    VulnerabilitiesModule,

    // IoT / MQTT ingest
    IotModule,

    // Cloud connectors (AWS / Azure)
    CloudConnectorsModule,

    // EAM — maintenance, spares, consumables, facility
    EamModule,

    // CMDB — business services & health rollup
    CmdbModule,

    // Global search (Meilisearch + Postgres fallback)
    SearchModule,
  ],
  providers: [
    ModuleGuard,
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TenantRlsInterceptor },
    { provide: APP_GUARD, useClass: ApiThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityMiddleware)
      .forRoutes('*');
  }
}

