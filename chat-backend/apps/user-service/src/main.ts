import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { UserServiceModule } from './user-service.module';
import { GlobalExceptionFilter, LoggingInterceptor } from '@app/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(UserServiceModule);

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
  await app.listen(port);

  console.log(`🚀 User Service running on: http://localhost:${port}`);
  console.log(`📚 API Docs available at: http://localhost:${port}/api/docs`);
  console.log(`📦 PostgreSQL: Connected to user_db`);
}

void bootstrap();
