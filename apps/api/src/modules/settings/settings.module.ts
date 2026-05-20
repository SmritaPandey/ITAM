import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { PaymentsWebhookController } from './payments-webhook.controller';

@Module({
  controllers: [SettingsController, PaymentsWebhookController],
  providers: [SettingsService],
})
export class SettingsModule {}
