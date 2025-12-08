import { Injectable, Logger } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly store = new Map<string, RateLimitEntry>();

  private readonly windowMs = 60 * 1000; // 1 minute window
  private readonly maxRequests = 100; // requests per window

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const entry = this.store.get(identifier);

    if (!entry || now > entry.resetTime) {
      // New window
      this.store.set(identifier, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    if (entry.count < this.maxRequests) {
      entry.count++;
      return true;
    }

    this.logger.warn(`Rate limit exceeded for ${identifier}`);
    return false;
  }

  getRemainingTime(identifier: string): number {
    const entry = this.store.get(identifier);
    if (!entry) return this.windowMs;
    const remaining = entry.resetTime - Date.now();
    return Math.max(0, remaining);
  }

  cleanup(): void {
    const now = Date.now();
    const expired = Array.from(this.store.entries())
      .filter(([, entry]) => now > entry.resetTime)
      .map(([key]) => key);
    expired.forEach((key) => this.store.delete(key));
  }
}
