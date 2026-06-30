import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';
import { SendMessageDto } from './dto/messages.dto';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async sendMessage(groupId: string, userId: string, dto: SendMessageDto) {
    // Check membership
    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!member || member.status !== 'active') {
      throw new ForbiddenException('Not an active member');
    }

    // Rate limit check
    const rateLimitKey = `message:rate:${userId}:${groupId}`;
    const canSend = await this.redis.checkRateLimit(rateLimitKey, 30, 60); // 30 per minute

    if (!canSend) {
      throw new BadRequestException('Message rate limit exceeded');
    }

    // Check for duplicate (idempotency)
    const existing = await this.prisma.message.findUnique({
      where: {
        groupId_clientMessageId: {
          groupId,
          clientMessageId: dto.clientMessageId,
        },
      },
    });

    if (existing) {
      return existing; // Return existing message
    }

    // Create message
    const message = await this.prisma.message.create({
      data: {
        groupId,
        senderId: userId,
        clientMessageId: dto.clientMessageId,
        type: dto.type,
        content: dto.content,
        mediaUrl: dto.mediaUrl,
        mediaType: dto.mediaType,
        parentMessageId: dto.parentMessageId,
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

    // Publish to Redis for WebSocket fanout
    await this.redis.publish(`group:${groupId}:messages`, {
      event: 'message.created',
      data: message,
    });

    return message;
  }

  async getMessages(groupId: string, userId: string, after?: string, limit: number = 50) {
    // Check membership
    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!member || member.status !== 'active') {
      throw new ForbiddenException('Not an active member');
    }

    const where: any = {
      groupId,
      deletedAt: null,
    };

    if (after) {
      where.createdAt = { gt: new Date(after) };
    }

    const messages = await this.prisma.message.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: Math.min(limit, 100),
    });

    return messages;
  }

  async editMessage(messageId: string, userId: string, content: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('Not your message');
    }

    if (message.deletedAt) {
      throw new BadRequestException('Message is deleted');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content,
        editedAt: new Date(),
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

    // Publish edit event
    await this.redis.publish(`group:${message.groupId}:messages`, {
      event: 'message.edited',
      data: updated,
    });

    return updated;
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        group: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const member = message.group.members[0];
    const isOwner = message.senderId === userId;
    const isMod = member && ['owner', 'admin', 'moderator'].includes(member.role);

    if (!isOwner && !isMod) {
      throw new ForbiddenException('Cannot delete this message');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    // Publish delete event
    await this.redis.publish(`group:${message.groupId}:messages`, {
      event: 'message.deleted',
      data: { id: messageId, groupId: message.groupId },
    });

    return { success: true };
  }

  async getUnreadCount(userId: string) {
    // This is a placeholder - in production, track last_read per group
    // For now, return 0
    return { unreadCount: 0 };
  }
}
