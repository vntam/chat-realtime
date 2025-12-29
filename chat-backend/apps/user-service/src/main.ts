import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { UserServiceModule } from './user-service.module';
import { GlobalExceptionFilter, LoggingInterceptor } from '@app/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(UserServiceModule);

  // Enable CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:5173'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Enable cookie parser
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('User Service API')
    .setDescription(
      'User authentication and management service with JWT token rotation',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.USER_SERVICE_PORT ?? process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 User Service running on: http://0.0.0.0:${port}`);
  console.log(`📚 API Docs available at: http://0.0.0.0:${port}/api/docs`);
  console.log(`📦 PostgreSQL: Connected to user_db`);
}

void bootstrap();
