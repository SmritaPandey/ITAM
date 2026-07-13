import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { SlaService } from './sla.service';
import { EmailIngestService } from './email-ingest.service';
import { EmailIngestController } from './email-ingest.controller';

@Module({
  controllers: [TicketsController, EmailIngestController],
  providers: [TicketsService, SlaService, EmailIngestService],
  exports: [TicketsService, SlaService, EmailIngestService],
})
export class TicketsModule {}
