import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ required: true, enum: ['private', 'group'] })
  type: string;

  @Prop({ required: true, type: [Number], index: true })
  participants: number[];

  // Group chat metadata
  @Prop({ type: String })
  name?: string; // Tên nhóm (chỉ cho type='group')

  @Prop({ type: String })
  avatar?: string; // Ảnh đại diện nhóm

  @Prop({ type: Number })
  admin_id?: number; // Admin chính (người tạo nhóm)

  @Prop({ type: [Number], default: [] })
  moderator_ids?: number[]; // Danh sách moderators (quyền phụ)

  // Message request fields
  @Prop({
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'accepted',
  })
  status: string;

  @Prop({ type: Number })
  initiator_id: number;

  @Prop({ type: Date, default: Date.now })
  created_at: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
