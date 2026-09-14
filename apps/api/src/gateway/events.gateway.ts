import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Server } from 'socket.io';
import { AnalyticsService } from '../analytics/analytics.service';

const WS_ALLOWED_ORIGINS = [
  'https://panel.xtreampulsar.com',
  'https://xtreampulsar.com',
  'https://www.xtreampulsar.com',
  'https://control.xtreampulsar.com',
  'https://painel.paineis.fun',
  'http://169.58.12.153',
  ...(process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
];

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      if (!origin || WS_ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  },
  namespace: '/ws',
})
export class EventsGateway {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(EventsGateway.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async broadcastDashboard(): Promise<void> {
    try {
      const data = await this.analyticsService.getDashboard();
      this.server.emit('dashboard:update', data);
    } catch (err) {
      this.logger.error(`broadcastDashboard: ${(err as Error).message}`);
    }
  }

  emitStreamStatus(streamId: string, status: string): void {
    this.server.emit('stream:status', { streamId, status });
  }

  emitConnectionUpdate(connection: unknown): void {
    this.server.emit('connection:new', connection);
  }

  emitConnectionClose(connectionId: string): void {
    this.server.emit('connection:close', { connectionId });
  }

  emitDownloadProgress(payload: Record<string, unknown>): void {
    this.server.emit('download:progress', payload);
  }
}
