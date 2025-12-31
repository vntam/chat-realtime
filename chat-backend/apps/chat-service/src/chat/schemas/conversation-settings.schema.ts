import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Conversation Settings Schema
 * Stores per-user settings for each conversation (pin, mute, hide, etc.)
 * This replaces the old architecture where settings were stored in User Service
 */
@Schema({ collection: 'conversation_settings' })
export class ConversationSettings {
  @Prop({ required: true, index: true })
  userId: number;

  @Prop({ required: true, index: true })
  conversationId: string;

  @Prop({ default: false })
  pinned: boolean;

  @Prop({ type: Number })
  pinnedOrder?: number;

  @Prop({ default: false })
  muted: boolean;

  @Prop({ type: Date })
  mutedUntil?: Date;

  @Prop({ default: false })
  hidden: boolean;

  @Prop({ type: Date })
  hiddenAt?: Date;

  @Prop({ type: Date })
  lastMessageCleared?: Date;

  @Prop({ default: Date.now() })
  createdAt: Date;

  @Prop({ default: Date.now() })
  updatedAt: Date;
}

export type ConversationSettingsDocument = ConversationSettings & Document;

export const ConversationSettingsSchema = SchemaFactory.createForClass(ConversationSettings);

// Compound index for efficient queries
ConversationSettingsSchema.index({ userId: 1, conversationId: 1 }, { unique: true });
