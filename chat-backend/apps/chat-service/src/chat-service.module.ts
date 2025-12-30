import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ChatModule } from './chat/chat.module';
import { UploadModule } from './upload/upload.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { MetricsInterceptor } from './metrics/metrics.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(
      process.env.CHAT_DB_URL || 'mongodb://localhost:27017/chat-service',
    ),
    MetricsModule,
    ChatModule,
    UploadModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    // RabbitMQ Client for sending events to Notification Service
    {
      provide: 'NOTIFICATION_SERVICE',
      useFactory: () => {
        return ClientProxyFactory.create({
          transport: Transport.RMQ,
          options: {
            urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
            queue: 'notification_queue',
            queueOptions: {
              durable: true,
            },
          },
        });
      },
    },
  ],
  exports: [ChatModule], // Export ChatModule for health checks
})
export class ChatServiceModule {}
