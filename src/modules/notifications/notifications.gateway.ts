import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthSessionService } from '../auth/auth-session.service';

type ServerEvents = { 'notifications:changed': () => void };
type SessionData = { userId: string; expiresAt?: number };
type NotificationSocket = Socket<never, ServerEvents, never, SessionData>;
type NotificationServer = Server<never, ServerEvents, never, SessionData>;

@WebSocketGateway({
  path: '/notifications/socket.io',
  transports: ['websocket'],
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection
{
  @WebSocketServer()
  private server?: NotificationServer;

  private readonly allowedOrigin: string;

  constructor(
    private readonly auth: AuthSessionService,
    config: ConfigService,
  ) {
    this.allowedOrigin = new URL(
      config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173',
    ).origin;
  }

  afterInit(server: NotificationServer) {
    server.use((socket, next) => {
      void this.authenticate(socket).then(
        () => next(),
        () => next(new Error('UNAUTHORIZED')),
      );
    });
  }

  handleConnection(socket: NotificationSocket) {
    void socket.join(this.room(socket.data.userId));
    if (socket.data.expiresAt !== undefined) {
      const timeout = setTimeout(
        () => socket.disconnect(true),
        Math.max(0, socket.data.expiresAt - Date.now()),
      );
      timeout.unref();
      socket.once('disconnect', () => clearTimeout(timeout));
    }
  }

  notifyChanged(userId: string) {
    this.server?.to(this.room(userId)).emit('notifications:changed');
  }

  private async authenticate(socket: NotificationSocket) {
    const origin = socket.handshake.headers.origin;
    const token: unknown = socket.handshake.auth.accessToken;
    if (
      (origin && origin !== this.allowedOrigin) ||
      typeof token !== 'string' ||
      !token ||
      token.length > 4096
    ) {
      throw new Error('Invalid socket credentials');
    }
    const session = await this.auth.verifyAccessToken(token);
    socket.data.userId = session.sub;
    if ('exp' in session && typeof session.exp === 'number') {
      socket.data.expiresAt = session.exp * 1000;
    }
  }

  private room(userId: string) {
    return `notifications:${userId.toLowerCase()}`;
  }
}
