import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationChannelsService } from './notification-channels.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationChannelsService],
  exports: [NotificationsService, NotificationChannelsService],
})
export class NotificationsModule {}
