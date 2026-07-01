import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { FirebaseService } from '@/common/firebase/firebase.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private firebase: FirebaseService,
  ) {}

  async sendPushNotification(
    userId: string,
    notification: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ) {
    // Get user's active devices with push tokens
    const devices = await this.prisma.userDevice.findMany({
      where: {
        userId,
        pushToken: { not: null },
        revokedAt: null,
      },
    });

    if (devices.length === 0) {
      this.logger.debug(`No push tokens for user ${userId}`);
      return;
    }

    const tokens = devices
      .map(d => d.pushToken)
      .filter((token): token is string => Boolean(token));

    try {
      const response = await this.firebase.sendMulticastPushNotification(tokens, notification);

      // Handle failures
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const failedToken = tokens[idx];
            if (failedToken) failedTokens.push(failedToken);
            this.logger.warn(`Push failed for token ${tokens[idx]}: ${resp.error?.message}`);
          }
        });

        // Optionally: Remove invalid tokens
        // await this.removeInvalidTokens(failedTokens);
      }

      this.logger.log(`Push sent to ${response.successCount}/${tokens.length} devices for user ${userId}`);
    } catch (error) {
      this.logger.error(`Push notification error: ${error.message}`);
    }
  }

  async sendGroupMessageNotification(groupId: string, senderId: string, messageContent: string) {
    // Get all group members except sender
    const members = await this.prisma.groupMember.findMany({
      where: {
        groupId,
        status: 'active',
        userId: { not: senderId },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        group: {
          select: {
            name: true,
          },
        },
      },
    });

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { name: true },
    });

    for (const member of members) {
      await this.sendPushNotification(member.userId, {
        title: member.group.name,
        body: `${sender?.name || 'Someone'}: ${messageContent.substring(0, 100)}`,
        data: {
          type: 'group_message',
          groupId,
          senderId,
        },
      });
    }
  }

  async sendJoinRequestNotification(groupId: string, requesterId: string) {
    // Notify group admins/mods
    const admins = await this.prisma.groupMember.findMany({
      where: {
        groupId,
        role: { in: ['owner', 'admin', 'moderator'] },
        status: 'active',
      },
      include: {
        group: {
          select: { name: true },
        },
      },
    });

    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { name: true },
    });

    for (const admin of admins) {
      await this.sendPushNotification(admin.userId, {
        title: 'New Join Request',
        body: `${requester?.name || 'Someone'} wants to join ${admin.group.name}`,
        data: {
          type: 'join_request',
          groupId,
          requesterId,
        },
      });
    }
  }

  async sendJoinApprovedNotification(userId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { name: true },
    });

    await this.sendPushNotification(userId, {
      title: 'Join Request Approved',
      body: `You've been added to ${group?.name}`,
      data: {
        type: 'join_approved',
        groupId,
      },
    });
  }

  private async removeInvalidTokens(tokens: string[]) {
    await this.prisma.userDevice.updateMany({
      where: {
        pushToken: { in: tokens },
      },
      data: {
        pushToken: null,
      },
    });
  }
}
