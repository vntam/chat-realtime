import { IConversation, IMessage } from './message.interface';

export class Conversation implements IConversation {
  _id: string;
  type: 'private' | 'group';
  participants: number[];
  group_id?: number;
  created_at: Date;

  constructor(data: IConversation) {
    this._id = data._id;
    this.type = data.type;
    this.participants = data.participants ?? [];
    this.group_id = data.group_id;
    this.created_at = data.created_at ?? new Date();
  }
}

export class Message implements IMessage {
  _id: string;
  conversation_id: string;
  sender_id: number;
  content: string;
  attachments?: string[];
  seen_by: number[];
  created_at: Date;

  constructor(data: IMessage) {
    this._id = data._id;
    this.conversation_id = data.conversation_id;
    this.sender_id = data.sender_id;
    this.content = data.content;
    this.attachments = data.attachments ?? [];
    this.seen_by = data.seen_by ?? [];
    this.created_at = data.created_at ?? new Date();
  }
}
