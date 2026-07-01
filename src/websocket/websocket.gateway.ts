import {
  WebSocketGateway as NestWebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';

function socketCorsOrigin() {
  const origins = process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? [];
  if (process.env.NODE_ENV === 'production') {
    return origins.filter((origin) => origin !== '*');
  }
  return origins.length > 0 ? origins : ['http://localhost:3000', 'http://localhost:3001'];
}

@NestWebSocketGateway({
  cors: {
    origin: socketCorsOrigin(),
    credentials: true,
  },
  path: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');
      const deviceId = client.handshake.auth.deviceId || client.handshake.headers['x-device-id'];

      if (!token || !deviceId) {
        this.logger.warn(`Connection rejected: missing token or deviceId`);
        client.disconnect();
        return;
      }

      // Verify JWT
      const payload = this.jwtService.verify<{ sub: string; deviceId: string }>(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      const userId = payload.sub;

      if (payload.deviceId !== deviceId) {
        this.logger.warn(`Connection rejected: device mismatch for user ${userId}`);
        client.disconnect();
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { status: true },
      });
      const device = await this.prisma.userDevice.findUnique({
        where: { id: deviceId },
        select: { userId: true, revokedAt: true },
      });

      if (!user || user.status === 'banned' || !device || device.userId !== userId || device.revokedAt) {
        this.logger.warn(`Connection rejected: inactive user or device for user ${userId}`);
        client.disconnect();
        return;
      }

      // Store user info in socket
      client.data.userId = userId;
      client.data.deviceId = deviceId;

      // Mark user as online in Redis
      await this.redis.setUserOnline(userId, client.id, deviceId);

      // Update last seen
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastSeenAt: new Date() },
      });

      this.logger.log(`User ${userId} connected on socket ${client.id}`);

      // Send connection acknowledgment
      client.emit('connected', {
        socketId: client.id,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    const socketId = client.id;

    if (userId) {
      await this.redis.setUserOffline(userId, socketId);
      this.logger.log(`User ${userId} disconnected from socket ${socketId}`);
    }
  }

  @SubscribeMessage('group.join')
  async handleJoinGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string },
  ) {
    const userId = client.data.userId;
    const { groupId } = data;

    // Verify membership
    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!member || member.status !== 'active') {
      client.emit('error', { message: 'Not a member of this group' });
      return;
    }

    // Join socket.io room
    client.join(`group:${groupId}`);

    // Track in Redis
    await this.redis.addUserToGroup(client.id, groupId);

    this.logger.log(`User ${userId} joined group ${groupId}`);

    client.emit('group.joined', { groupId });
  }

  @SubscribeMessage('group.leave')
  async handleLeaveGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string },
  ) {
    const { groupId } = data;

    client.leave(`group:${groupId}`);
    await this.redis.removeUserFromGroup(client.id, groupId);

    client.emit('group.left', { groupId });
  }

  @SubscribeMessage('message.send')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const userId = client.data.userId;
    const { groupId, clientMessageId, type, content, mediaUrl } = data;

    // Verify membership
    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!member || member.status !== 'active') {
      client.emit('error', { message: 'Not a member' });
      return;
    }

    // Rate limit check
    const rateLimitKey = `message:rate:${userId}:${groupId}`;
    const canSend = await this.redis.checkRateLimit(rateLimitKey, 30, 60);

    if (!canSend) {
      client.emit('error', { message: 'Rate limit exceeded' });
      return;
    }

    // Check for duplicate
    const existing = await this.prisma.message.findUnique({
      where: {
        groupId_clientMessageId: {
          groupId,
          clientMessageId,
        },
      },
    });

    if (existing) {
      client.emit('message.ack', { clientMessageId, messageId: existing.id });
      return;
    }

    // Create message
    const message = await this.prisma.message.create({
      data: {
        groupId,
        senderId: userId,
        clientMessageId,
        type,
        content,
        mediaUrl,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Send ACK to sender
    client.emit('message.ack', {
      clientMessageId,
      messageId: message.id,
      createdAt: message.createdAt,
    });

    // Broadcast to group
    this.server.to(`group:${groupId}`).emit('message.created', message);

    this.logger.log(`Message ${message.id} sent to group ${groupId}`);
  }

  @SubscribeMessage('typing.start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string },
  ) {
    const userId = client.data.userId;
    const { groupId } = data;

    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member || member.status !== 'active') {
      client.emit('error', { message: 'Not a member' });
      return;
    }

    // Broadcast to others in group
    client.to(`group:${groupId}`).emit('user.typing', {
      groupId,
      userId,
      typing: true,
    });
  }

  @SubscribeMessage('typing.stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string },
  ) {
    const userId = client.data.userId;
    const { groupId } = data;

    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member || member.status !== 'active') {
      client.emit('error', { message: 'Not a member' });
      return;
    }

    client.to(`group:${groupId}`).emit('user.typing', {
      groupId,
      userId,
      typing: false,
    });
  }

  // Admin: broadcast to specific group
  async broadcastToGroup(groupId: string, event: string, data: any) {
    this.server.to(`group:${groupId}`).emit(event, data);
  }

  // Admin: broadcast to specific user
  async broadcastToUser(userId: string, event: string, data: any) {
    const sockets = await this.redis.getUserSockets(userId);
    for (const socketId of sockets) {
      this.server.to(socketId).emit(event, data);
    }
  }
}
