import { Module } from '@nestjs/common';
import { PlatformUpdateController } from './platform-update.controller';
import { PlatformUpdateService } from './platform-update.service';

@Module({
  controllers: [PlatformUpdateController],
  providers: [PlatformUpdateService],
})
export class PlatformUpdateModule {}
