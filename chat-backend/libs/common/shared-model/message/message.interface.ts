export interface IConversation {
  _id: string;
  type: 'private' | 'group';
  participants: number[];
  group_id?: number;
  created_at: Date;
}

export interface IMessage {
  _id: string;
  conversation_id: string;
  sender_id: number;
  content: string;
  attachments?: string[];
  seen_by: number[];
  created_at: Date;
}
