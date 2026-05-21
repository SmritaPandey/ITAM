import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { PricingController } from './pricing.controller';
import { PaymentsWebhookController } from './payments-webhook.controller';

@Module({
  controllers: [SettingsController, PricingController, PaymentsWebhookController],
  providers: [SettingsService],
})
export class SettingsModule {}
