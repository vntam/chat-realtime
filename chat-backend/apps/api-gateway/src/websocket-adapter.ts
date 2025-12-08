import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

export interface AuthenticatedSocket extends Socket {
  userId?: number;
  roles?: string[];
  traceId?: string;
}

@Injectable()
export class WebSocketGatewayAdapter {
  private readonly logger = new Logger(WebSocketGatewayAdapter.name);

  setupAuthentication(server: Server): void {
    server.use((socket: AuthenticatedSocket, next) => {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(' ')[1];
      const traceId = socket.handshake.headers['x-trace-id'] as string;

      socket.traceId = traceId || socket.id;

      if (!token) {
        this.logger.warn(
          `[${socket.traceId}] WebSocket connection without token`,
        );
        return next(new Error('Missing token'));
      }

      try {
        const secret = process.env.JWT_ACCESS_SECRET || 'your-secret-key';
        const payload = jwt.verify(token as string, secret) as any;
        socket.userId = payload.sub;
        socket.roles = payload.roles || [];
        this.logger.debug(
          `[${socket.traceId}] WebSocket authenticated for user ${payload.sub}`,
        );
        next();
      } catch (error) {
        this.logger.warn(
          `[${socket.traceId}] WebSocket auth failed: ${error?.message}`,
        );
        next(new Error('Invalid token'));
      }
    });

    // Log connection/disconnection
    server.on('connection', (socket: AuthenticatedSocket) => {
      this.logger.log(`[${socket.traceId}] User ${socket.userId} connected`);
      socket.on('disconnect', () => {
        this.logger.log(
          `[${socket.traceId}] User ${socket.userId} disconnected`,
        );
      });
    });
  }
}
