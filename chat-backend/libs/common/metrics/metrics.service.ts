import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, register, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  // HTTP Metrics
  public readonly httpRequestsTotal: Counter;
  public readonly httpRequestDuration: Histogram;

  // Business Metrics
  public readonly messagesTotal: Counter;
  public readonly activeUsers: Gauge;
  public readonly activeConnections: Gauge;

  // System Metrics
  public readonly memoryUsage: Gauge;
  public readonly cpuUsage: Gauge;

  constructor() {
    this.registry = register;

    // Initialize HTTP metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    // Initialize business metrics
    this.messagesTotal = new Counter({
      name: 'messages_sent_total',
      help: 'Total number of messages sent',
      labelNames: ['type'], // private, group
      registers: [this.registry],
    });

    this.activeUsers = new Gauge({
      name: 'active_users',
      help: 'Number of active users',
      registers: [this.registry],
    });

    this.activeConnections = new Gauge({
      name: 'websocket_connections_active',
      help: 'Number of active WebSocket connections',
      registers: [this.registry],
    });

    // Initialize system metrics
    this.memoryUsage = new Gauge({
      name: 'process_memory_usage_bytes',
      help: 'Process memory usage in bytes',
      labelNames: ['type'], // rss, heapTotal, heapUsed, external
      registers: [this.registry],
    });

    this.cpuUsage = new Gauge({
      name: 'process_cpu_usage_percent',
      help: 'Process CPU usage percentage',
      registers: [this.registry],
    });

    // Update system metrics every 10 seconds
    this.startSystemMetricsCollection();
  }

  // Track HTTP request
  trackHttpRequest(
    method: string,
    path: string,
    status: number,
    duration: number,
  ) {
    this.httpRequestsTotal.inc({
      method,
      path,
      status: status.toString(),
    });

    this.httpRequestDuration.observe(
      { method, path },
      duration / 1000, // Convert to seconds
    );
  }

  // Track message sent
  trackMessageSent(type: 'private' | 'group') {
    this.messagesTotal.inc({ type });
  }

  // Update active users count
  setActiveUsers(count: number) {
    this.activeUsers.set(count);
  }

  // Update active connections count
  setActiveConnections(count: number) {
    this.activeConnections.set(count);
  }

  // Get all metrics in Prometheus format
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  // Start collecting system metrics
  private startSystemMetricsCollection() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
      this.memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
      this.memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
      this.memoryUsage.set({ type: 'external' }, memUsage.external);

      const cpuUsageData = process.cpuUsage();
      const cpuPercent =
        ((cpuUsageData.user + cpuUsageData.system) / 1000000) * 100;
      this.cpuUsage.set(cpuPercent);
    }, 10000); // Every 10 seconds
  }

  // Reset all metrics (useful for testing)
  resetMetrics() {
    this.registry.resetMetrics();
  }
}
