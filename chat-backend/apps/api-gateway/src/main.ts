import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ApiGatewayModule } from './api-gateway.module';
import {
  createReverseProxyMiddleware,
  createWebSocketProxyMiddleware,
} from './reverse-proxy.middleware';
import { GlobalExceptionFilter, LoggingInterceptor } from '@app/common';

async function bootstrap() {
  // Gateway always runs on HTTP
  // SSL/TLS is handled by AWS ALB (Application Load Balancer)
  const app = await NestFactory.create(ApiGatewayModule, {
    bufferLogs: true,
  });
  const logger = new Logger('Bootstrap');

  // CORS configuration
  const origins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({
    origin: origins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Trace-Id',
    ],
    maxAge: 600,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger API documentation (Gateway infrastructure endpoints only)
  const config = new DocumentBuilder()
    .setTitle('API Gateway')
    .setDescription(
      'Reverse proxy gateway for microservices. For full API documentation, visit individual services:\n\n' +
        '• User Service: http://localhost:3001/api/docs\n' +
        '• Chat Service: http://localhost:3002/api/docs\n' +
        '• Notification Service: http://localhost:3003/api/docs',
    )
    .setVersion('1.0')
    .addTag('Infrastructure', 'Gateway health and metrics endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Reverse proxy middleware for REST routes
  const userServiceUrl =
    process.env.USER_SERVICE_URL ?? 'http://localhost:3001';
  const chatServiceUrl =
    process.env.CHAT_SERVICE_URL ?? 'http://localhost:3002';
  const notificationServiceUrl =
    process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:3003';

  // REST API reverse proxy
  app.use('/auth', createReverseProxyMiddleware('/auth', userServiceUrl));
  app.use('/user', createReverseProxyMiddleware('/user', userServiceUrl));
  app.use('/chat', createReverseProxyMiddleware('/chat', chatServiceUrl));
  app.use('/upload', createReverseProxyMiddleware('/upload', chatServiceUrl));
  app.use(
    '/notification',
    createReverseProxyMiddleware('/notification', notificationServiceUrl),
  );

  // WebSocket reverse proxy
  app.use(
    '/socket.io',
    createWebSocketProxyMiddleware('/socket.io', chatServiceUrl),
  );
  app.use(
    '/notifications',
    createWebSocketProxyMiddleware('/notifications', notificationServiceUrl),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`🚀 API Gateway running on: http://localhost:${port}`);
  logger.log(`📚 API Docs available at: http://localhost:${port}/api/docs`);
  logger.log(`📊 Metrics available at: http://localhost:${port}/metrics`);
  logger.log(`🏥 Health check at: http://localhost:${port}/health`);
  logger.log(`\n📌 Proxying to:`);
  logger.log(`   • User Service: ${userServiceUrl}`);
  logger.log(`   • Chat Service: ${chatServiceUrl}`);
  logger.log(`   • Notification Service: ${notificationServiceUrl}`);
  logger.log(`🌐 Allowed Origins: ${origins.join(', ')}`);
  logger.log(
    `🔄 Architecture: Client → [HTTPS via ALB] → Gateway (HTTP) → Services`,
  );
}
bootstrap().catch((error) => {
  console.error('Bootstrap failed:', error);
  process.exit(1);
});
