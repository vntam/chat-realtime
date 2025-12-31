import { Injectable, OnModuleInit } from '@nestjs/common';
import { Server } from 'socket.io';

/**
 * Service to hold WebSocket server instance reference
 * This allows REST controllers to emit WebSocket events
 */
@Injectable()
export class SocketService implements OnModuleInit {
  private server: Server | null = null;

  onModuleInit() {
    // Server will be set by the gateway
  }

  setServer(server: Server) {
    this.server = server;
  }

  getServer(): Server | null {
    return this.server;
  }

  /**
   * Emit conversation:created event to all participants
   */
  emitConversationCreated(conversation: any) {
    if (!this.server) {
      console.warn('[SocketService] Server not initialized, cannot emit event');
      return;
    }

    if (!conversation.participants) {
      console.warn('[SocketService] Conversation has no participants');
      return;
    }

    conversation.participants.forEach((participantId: number) => {
      this.server!.to(`user:${participantId}`).emit('conversation:created', {
        conversationId: conversation._id?.toString(),
        conversation,
      });
    });

    console.log(`[SocketService] Emitted conversation:created to ${conversation.participants.length} participants`);
  }

  /**
   * Emit conversation:deleted event to all participants
   * Used when a conversation is deleted via REST API
   */
  emitConversationDeleted(conversationId: string, participantIds: number[]) {
    if (!this.server) {
      console.warn('[SocketService] Server not initialized, cannot emit event');
      return;
    }

    participantIds.forEach((participantId: number) => {
      this.server!.to(`user:${participantId}`).emit('conversation:deleted', {
        conversationId,
      });
    });

    console.log(`[SocketService] Emitted conversation:deleted to ${participantIds.length} participants`);
  }
}
