export class UserUnblockedEvent {
  constructor(
    public readonly blockerId: number,
    public readonly unblockedUserId: number,
  ) {}
}
