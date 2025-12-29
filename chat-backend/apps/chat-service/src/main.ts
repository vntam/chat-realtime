import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import {
  GlobalExceptionFilter,
  LoggingInterceptor,
  WsExceptionFilter,
} from '@app/common';
import cookieParser from 'cookie-parser';
import { ChatServiceModule } from './chat-service.module';
import { getChatWsDocs } from './ws-docs';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ChatServiceModule);

  // Enable CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:5173'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filters
  app.useGlobalFilters(new GlobalExceptionFilter(), new WsExceptionFilter());

  // Global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Cookie parser
  app.use(cookieParser());

  // Expose lightweight WebSocket documentation (Option 2)
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/ws-docs', (req: any, res: any) => {
    const docs = getChatWsDocs();
    res.type('application/json').send(docs);
  });

  const port = process.env.CHAT_SERVICE_PORT || 3002;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Chat Service running on: http://0.0.0.0:${port}`);
  console.log(`📚 WS Docs available at: http://0.0.0.0:${port}/ws-docs`);
  console.log(`🔌 WebSocket namespace: ws://0.0.0.0:${port}/chat`);
  console.log(`📦 MongoDB: Connected to chat_db`);
}

void bootstrap();
