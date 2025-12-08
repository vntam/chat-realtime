export interface INotification {
  _id?: string;
  user_id: number;
  type: 'message' | 'group_invite' | 'system';
  title: string;
  content: string;
  is_read: boolean;
  related_id?: string;
  created_at: Date;
}
