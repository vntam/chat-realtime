import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

export enum MessageType {
  USER = 'user',        // Regular message from user
  SYSTEM = 'system',    // System message (join, leave, etc.)
}

export interface DeliveryInfo {
  user_id: number;
  status: MessageStatus;
  timestamp: Date;
}

@Schema({ timestamps: true })
export class Message {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'Conversation',
    index: true,
  })
  conversation_id: Types.ObjectId;

  @Prop({ required: true, type: Number, index: true })
  sender_id: number;

  @Prop({ required: true })
  content: string;

  @Prop({
    type: String,
    enum: Object.values(MessageType),
    default: MessageType.USER,
  })
  type: MessageType;

  // For system messages: store related user IDs and event type
  // Example: { event: 'member_added', userId: 123, actorId: 456, actorName: 'John', targetName: 'Jane' }
  @Prop({ type: Object, default: null })
  system_data?: {
    event: 'member_added' | 'member_removed' | 'group_created' | 'group_deleted';
    userId?: number;
    actorId?: number;  // Who performed the action
    actorName?: string;  // Name of actor
    targetName?: string;  // Name of target user
  };

  @Prop({ type: [String], default: [] })
  attachments: string[];

  @Prop({ type: [Number], default: [] })
  seen_by: number[];

  @Prop({
    type: String,
    enum: Object.values(MessageStatus),
    default: MessageStatus.SENT,
  })
  status: MessageStatus;

  @Prop({
    type: [
      {
        user_id: { type: Number, required: true },
        status: {
          type: String,
          enum: Object.values(MessageStatus),
          required: true,
        },
        timestamp: { type: Date, required: true },
      },
    ],
    default: [],
  })
  delivery_info: DeliveryInfo[];

  @Prop({ type: Date })
  delivered_at?: Date;

  @Prop({ type: Date })
  read_at?: Date;

  @Prop({ type: Date, default: Date.now, index: true })
  created_at: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Compound index for efficient conversation message queries (sorted by time)
MessageSchema.index({ conversation_id: 1, created_at: -1 });

// Index for sender-specific queries
MessageSchema.index({ sender_id: 1, created_at: -1 });

// Text index for full-text search on message content
MessageSchema.index({ content: 'text' });
