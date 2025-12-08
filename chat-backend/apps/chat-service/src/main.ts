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

  // CORS is handled by API Gateway
  // Internal microservice communication only

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
  await app.listen(port);

  console.log(`🚀 Chat Service running on: http://localhost:${port}`);
  console.log(`📚 WS Docs available at: http://localhost:${port}/ws-docs`);
  console.log(`🔌 WebSocket namespace: ws://localhost:${port}/chat`);
  console.log(`📦 MongoDB: Connected to chat_db`);
}

void bootstrap();
