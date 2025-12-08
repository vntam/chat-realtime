import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { DatabaseHealthIndicator } from '@app/common';
import { Public } from '@app/common';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: DatabaseHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  @Get('live')
  @Public()
  @HealthCheck()
  checkLive() {
    // Simple liveness check - is the service running?
    return this.health.check([]);
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  checkReady() {
    // Readiness check - is the service ready to accept traffic?
    return this.health.check([
      // Database must be up
      () => this.db.isHealthy('database'),

      // Memory usage < 1.5GB
      () => this.memory.checkHeap('memory_heap', 1500 * 1024 * 1024),
    ]);
  }

  @Get()
  @Public()
  @HealthCheck()
  checkDetailed() {
    // Detailed health check with all components
    return this.health.check([
      () => this.db.isHealthy('database'),
      () => this.memory.checkHeap('memory_heap', 1500 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 2000 * 1024 * 1024),
      () =>
        this.disk.checkStorage('disk', {
          path: '/',
          thresholdPercent: 0.9,
        }),
    ]);
  }
}
