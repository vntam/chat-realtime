import { INotification } from './notification.interface';

export class Notification implements INotification {
  _id?: string;
  user_id: number;
  type: 'message' | 'group_invite' | 'system';
  title: string;
  content: string;
  is_read: boolean;
  related_id?: string;
  created_at: Date;

  constructor(data: INotification) {
    this._id = data._id;
    this.user_id = data.user_id;
    this.type = data.type;
    this.title = data.title;
    this.content = data.content;
    this.is_read = data.is_read ?? false;
    this.related_id = data.related_id;
    this.created_at = data.created_at ?? new Date();
  }
}
