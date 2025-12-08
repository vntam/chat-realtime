import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { GatewayMiddleware } from './gateway.middleware';
import { JwtGuard } from './jwt.guard';
import { RateLimiterService } from './rate-limiter.service';
import { WebSocketGatewayAdapter } from './websocket-adapter';
import { HealthModule } from './health/health.module';
import { MetricsService, MetricsController } from '@app/common';
import { MetricsInterceptor } from './metrics/metrics.interceptor';

/**
 * API Gateway Module - Reverse Proxy Gateway
 *
 * Responsibilities:
 * 1. Authentication (JWT verification at gateway entry)
 * 2. Rate limiting (per-IP, per-user)
 * 3. Tracing (trace-id injection and propagation)
 * 4. Reverse proxy (http-proxy-middleware tunnels to services)
 * 5. WebSocket reverse proxy (ws:// tunnel)
 * 6. CORS (centralized at gateway)
 * 7. Health checks and metrics
 *
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HealthModule,
  ],
  controllers: [MetricsController],
  providers: [
    RateLimiterService,
    WebSocketGatewayAdapter,
    MetricsService,
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class ApiGatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(GatewayMiddleware).forRoutes('*');
  }
}
