import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NicknameDocument = Nickname & Document;

@Schema({ timestamps: true })
export class Nickname {
  _id: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  conversation_id: Types.ObjectId;

  @Prop({ required: true })
  owner_id: number; // User who SET the nickname

  @Prop({ required: true })
  target_user_id: number; // User who RECEIVES the nickname

  @Prop({ required: true })
  nickname: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const NicknameSchema = SchemaFactory.createForClass(Nickname);

// Index for quick lookup
NicknameSchema.index({ conversation_id: 1, target_user_id: 1 }, { unique: true });
