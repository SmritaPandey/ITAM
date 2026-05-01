import { Module } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';
import { ScriptLibraryController } from './script-library.controller';

@Module({
  controllers: [AutomationController, ScriptLibraryController],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
