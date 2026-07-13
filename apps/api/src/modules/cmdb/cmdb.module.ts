import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CmdbController } from './cmdb.controller';
import { CmdbService } from './cmdb.service';

@Module({
  imports: [AuthModule],
  controllers: [CmdbController],
  providers: [CmdbService],
  exports: [CmdbService],
})
export class CmdbModule {}
