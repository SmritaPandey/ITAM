import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationChannelsService } from './notification-channels.service';
import { EmailService } from './email.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationChannelsService, EmailService],
  exports: [NotificationsService, NotificationChannelsService, EmailService],
})
export class NotificationsModule {}
