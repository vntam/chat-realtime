export class UserBlockedEvent {
  constructor(
    public readonly blockerId: number,
    public readonly blockedUserId: number,
  ) {}
}
