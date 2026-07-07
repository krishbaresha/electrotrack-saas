import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:5173'];
      if (!origin) {
        callback(null, true);
        return;
      }
      const isAllowed = allowedOrigins.some((allowed) => {
        if (allowed === origin) return true;
        try {
          const allowedUrl = new URL(allowed);
          const originUrl = new URL(origin);
          const allowedHost = allowedUrl.hostname;
          const originHost = originUrl.hostname;
          return originHost === allowedHost || originHost.endsWith('.' + allowedHost);
        } catch {
          return false;
        }
      });
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
  namespace: 'events',
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(private jwtService: JwtService) {}

  afterInit() {
    this.logger.log('WebSocket gateway initialized');
  }

  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth as Record<string, string>)?.token ??
      (client.handshake.headers?.authorization as string | undefined)?.replace(
        'Bearer ',
        '',
      );

    if (!token) {
      client.emit('error', 'Authentication required');
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify<{ sub: string; role: string }>(
        token,
      );
      (client.data as Record<string, unknown>).user = payload;
      this.logger.log(`Client connected: ${client.id} (role: ${payload.role})`);
    } catch {
      client.emit('error', 'Invalid token');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { shopId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = (client.data as Record<string, { role: string }>).user;
    if (!user || user.role !== 'owner') {
      throw new UnauthorizedException(
        'Only owners can subscribe to the dashboard room',
      );
    }
    void client.join(`shop_${data.shopId}`);
    return { event: 'subscribed', room: `shop_${data.shopId}` };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { shopId: string },
    @ConnectedSocket() client: Socket,
  ) {
    void client.leave(`shop_${data.shopId}`);
    return { event: 'unsubscribed', room: `shop_${data.shopId}` };
  }

  @OnEvent('sale.created')
  handleSaleCreated(payload: unknown) {
    this.server.emit('sale.created', payload);
  }

  @OnEvent('return.created')
  handleReturnCreated(payload: unknown) {
    this.server.emit('return.created', payload);
  }

  @OnEvent('return.requested')
  handleReturnRequested(payload: unknown) {
    this.server.emit('return_requested', payload);
  }

  @OnEvent('stock.low')
  handleStockLow(payload: unknown) {
    this.server.emit('stock.low', payload);
  }

  @OnEvent('cash.submitted')
  handleCashSubmitted(payload: unknown) {
    this.server.emit('cash_submitted', payload);
  }
}
