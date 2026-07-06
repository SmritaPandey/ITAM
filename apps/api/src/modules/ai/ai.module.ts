import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/database/prisma.module';
import { EventBusModule } from '../../common/events/event-bus.module';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { SoftwareModule } from '../software/software.module';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [PrismaModule, ConfigModule, EventBusModule, SoftwareModule, RiskModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
