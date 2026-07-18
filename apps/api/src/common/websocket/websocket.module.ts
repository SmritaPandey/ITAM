import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventsGateway } from './events.gateway';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error('FATAL: JWT_SECRET is required for WebSocket auth in production');
          }
          return { secret: 'assetcommand-fallback-jwt-secret' };
        }
        return { secret };
      },
    }),
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class WebSocketModule {}
