import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class MongoHealthIndicator extends HealthIndicator {
  constructor(@InjectConnection() private readonly connection: Connection) {
    super();
  }

  isHealthy(key: string): HealthIndicatorResult {
    const stateNum = Number(this.connection.readyState);
    const isConnected = stateNum === 1;

    if (isConnected) {
      return this.getStatus(key, true, {
        message: 'MongoDB is up',
        state: stateNum,
      });
    }

    throw new HealthCheckError(
      'MongoDB check failed',
      this.getStatus(key, false, {
        message: 'MongoDB is down',
        state: stateNum,
      }),
    );
  }
}
