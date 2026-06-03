import { Module } from '@nestjs/common';
import { PatchesService } from './patches.service';
import { PatchesController } from './patches.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PatchesController],
  providers: [PatchesService],
  exports: [PatchesService],
})
export class PatchesModule {}
