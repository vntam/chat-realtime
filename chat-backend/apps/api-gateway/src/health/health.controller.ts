import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '@app/common';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  @Get('live')
  @Public()
  @HealthCheck()
  checkLive() {
    return this.health.check([]);
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  checkReady() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 1500 * 1024 * 1024),
    ]);
  }

  @Get()
  @Public()
  @HealthCheck()
  checkDetailed() {
    return this.health.check([
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
