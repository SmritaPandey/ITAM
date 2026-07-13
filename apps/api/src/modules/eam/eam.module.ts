import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EamController } from './eam.controller';
import { EamService } from './eam.service';

@Module({
  imports: [AuthModule],
  controllers: [EamController],
  providers: [EamService],
  exports: [EamService],
})
export class EamModule {}
