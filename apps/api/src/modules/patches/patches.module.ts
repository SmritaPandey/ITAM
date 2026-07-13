import { Module } from '@nestjs/common';
import { PatchesService } from './patches.service';
import { PatchesController } from './patches.controller';
import { PatchCatalogService } from './patch-catalog.service';
import { PatchPolicyService } from './patch-policy.service';
import { PatchBundleService } from './patch-bundle.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PatchesController],
  providers: [
    PatchesService,
    PatchCatalogService,
    PatchPolicyService,
    PatchBundleService,
  ],
  exports: [PatchesService, PatchCatalogService, PatchPolicyService],
})
export class PatchesModule {}
