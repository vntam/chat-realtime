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
    : [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://chatrealtime-frontend-s3-2025.s3-website-ap-southeast-1.amazonaws.com',
      ];

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

  // Use PORT for Render compatibility, fallback to CHAT_SERVICE_PORT or 3002
  const port = process.env.PORT ?? process.env.CHAT_SERVICE_PORT ?? 3002;

  console.log(`🎯 About to listen on port ${port}...`);

  await app.listen(port, '0.0.0.0');

  console.log(`✅ HTTP Server is NOW listening on port ${port}`);
  console.log(`🚀 Chat Service running on: http://0.0.0.0:${port}`);
  console.log(`📚 WS Docs available at: http://0.0.0.0:${port}/ws-docs`);
  console.log(`🔌 WebSocket namespace: ws://0.0.0.0:${port}/chat`);
  console.log(`📦 MongoDB: Connected to chat_db`);
  console.log(`🌐 Testing HTTP server...`);

  // Test HTTP server by making a simple HTTP request to itself
  try {
    const httpServer = app.getHttpAdapter().getInstance();
    const server = httpServer?.httpServer;
    if (server) {
      console.log(`✅ HTTP Server instance found and listening`);
      console.log(`🔧 Server listening: ${server.listening ? 'YES' : 'NO'}`);
      console.log(`🔧 Server port: ${server.address()?.port}`);
    }
  } catch (error) {
    console.error(`❌ Error checking HTTP server:`, error.message);
  }
}

void bootstrap();
