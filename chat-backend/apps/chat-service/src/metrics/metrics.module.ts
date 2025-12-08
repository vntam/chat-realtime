import { Module, Global } from '@nestjs/common';
import { MetricsService, MetricsController } from '@app/common';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
