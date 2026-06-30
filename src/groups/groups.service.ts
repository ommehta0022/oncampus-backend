import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';
import { CreateGroupDto, UpdateGroupDto } from './dto/groups.dto';

@Injectable()
export class GroupsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async createGroup(userId: string, dto: CreateGroupDto) {
    // Rate limit check
    const rateLimitKey = `group:create:${userId}`;
    const canCreate = await this.redis.checkRateLimit(rateLimitKey, 5, 86400); // 5 per day

    if (!canCreate) {
      throw new BadRequestException('Group creation limit reached. Try again tomorrow.');
    }

    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        description: dto.description,
        city: dto.city,
        category: dto.category,
        visibility: dto.visibility,
        joinPolicy: dto.joinPolicy,
        memberLimit: dto.memberLimit || 50000,
        institutionId: dto.institutionId,
        createdBy: userId,
        members: {
          create: {
            userId,
            role: 'owner',
            status: 'active',
          },
        },
      },
      include: {
        institution: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    return group;
  }

  async getGroup(groupId: string, userId?: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId, deletedAt: null },
      include: {
        institution: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Get user's membership if authenticated
    let membership = null;
    if (userId) {
      membership = await this.prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });
    }

    return {
      ...group,
      memberCount: group._count.members,
      userRole: membership?.role || null,
      userStatus: membership?.status || null,
      isMember: !!membership,
    };
  }

  async getUserGroups(userId: string) {
    const memberships = await this.prisma.groupMember.findMany({
      where: {
        userId,
        status: 'active',
        group: {
          deletedAt: null,
        },
      },
      include: {
        group: {
          include: {
            institution: {
              select: {
                id: true,
                name: true,
                city: true,
              },
            },
            _count: {
              select: {
                members: true,
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    return memberships.map(m => ({
      ...m.group,
      memberCount: m.group._count.members,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async updateGroup(groupId: string, userId: string, dto: UpdateGroupDto) {
    await this.checkGroupPermission(groupId, userId, ['owner', 'admin']);

    const group = await this.prisma.group.update({
      where: { id: groupId },
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        visibility: dto.visibility,
        joinPolicy: dto.joinPolicy,
        memberLimit: dto.memberLimit,
        updatedAt: new Date(),
      },
    });

    return group;
  }

  async deleteGroup(groupId: string, userId: string) {
    await this.checkGroupPermission(groupId, userId, ['owner']);

    await this.prisma.group.update({
      where: { id: groupId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async createJoinRequest(groupId: string, userId: string) {
    // Check if group exists
    const group = await this.prisma.group.findUnique({
      where: { id: groupId, deletedAt: null },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check member limit
    if (group._count.members >= group.memberLimit) {
      throw new BadRequestException('Group is full');
    }

    // Check if already a member
    const existingMember = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (existingMember) {
      throw new BadRequestException('Already a member');
    }

    // Check for existing pending request
    const existingRequest = await this.prisma.joinRequest.findFirst({
      where: {
        groupId,
        userId,
        status: 'pending',
      },
    });

    if (existingRequest) {
      throw new BadRequestException('Join request already pending');
    }

    // Rate limit
    const rateLimitKey = `join:request:${userId}`;
    const canRequest = await this.redis.checkRateLimit(rateLimitKey, 20, 3600); // 20 per hour

    if (!canRequest) {
      throw new BadRequestException('Too many join requests. Try again later.');
    }

    // Check join policy
    if (group.joinPolicy === 'invite_only') {
      throw new ForbiddenException('This group is invite-only');
    }

    // Auto-approve for verified users if policy allows
    if (group.joinPolicy === 'auto_approve_verified') {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (user?.verified && user.city === group.city) {
        // Auto-approve
        await this.prisma.groupMember.create({
          data: {
            groupId,
            userId,
            role: 'member',
            status: 'active',
          },
        });

        await this.prisma.joinRequest.create({
          data: {
            groupId,
            userId,
            status: 'approved',
            source: 'auto_verified',
            decidedAt: new Date(),
          },
        });

        return { status: 'approved', autoJoined: true };
      }
    }

    // Create pending request
    const request = await this.prisma.joinRequest.create({
      data: {
        groupId,
        userId,
        status: 'pending',
        source: 'discovery',
      },
    });

    return { status: 'pending', requestId: request.id };
  }

  async getJoinRequests(groupId: string, userId: string) {
    await this.checkGroupPermission(groupId, userId, ['owner', 'admin', 'moderator']);

    const requests = await this.prisma.joinRequest.findMany({
      where: {
        groupId,
        status: 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            city: true,
            verified: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return requests;
  }

  async approveJoinRequest(groupId: string, requestId: string, userId: string) {
    await this.checkGroupPermission(groupId, userId, ['owner', 'admin', 'moderator']);

    const request = await this.prisma.joinRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.status !== 'pending') {
      throw new BadRequestException('Invalid request');
    }

    // Add as member
    await this.prisma.groupMember.create({
      data: {
        groupId: request.groupId,
        userId: request.userId,
        role: 'member',
        status: 'active',
      },
    });

    // Update request
    await this.prisma.joinRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        decidedBy: userId,
        decidedAt: new Date(),
      },
    });

    return { success: true };
  }

  async rejectJoinRequest(groupId: string, requestId: string, userId: string) {
    await this.checkGroupPermission(groupId, userId, ['owner', 'admin', 'moderator']);

    const request = await this.prisma.joinRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.status !== 'pending') {
      throw new BadRequestException('Invalid request');
    }

    await this.prisma.joinRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        decidedBy: userId,
        decidedAt: new Date(),
      },
    });

    return { success: true };
  }

  async leaveGroup(groupId: string, userId: string) {
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new BadRequestException('Not a member');
    }

    if (membership.role === 'owner') {
      throw new ForbiddenException('Owner cannot leave group. Delete or transfer ownership first.');
    }

    await this.prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    return { success: true };
  }

  async getMembers(groupId: string, userId: string) {
    await this.checkMembership(groupId, userId);

    const members = await this.prisma.groupMember.findMany({
      where: {
        groupId,
        status: 'active',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            city: true,
            verified: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { joinedAt: 'asc' },
      ],
    });

    return members;
  }

  async updateMemberRole(
    groupId: string,
    targetUserId: string,
    newRole: string,
    actorUserId: string,
  ) {
    await this.checkGroupPermission(groupId, actorUserId, ['owner', 'admin']);

    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === 'owner') {
      throw new ForbiddenException('Cannot change owner role');
    }

    await this.prisma.groupMember.update({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId,
        },
      },
      data: { role: newRole as any },
    });

    return { success: true };
  }

  async removeMember(groupId: string, targetUserId: string, actorUserId: string) {
    await this.checkGroupPermission(groupId, actorUserId, ['owner', 'admin', 'moderator']);

    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === 'owner') {
      throw new ForbiddenException('Cannot remove owner');
    }

    await this.prisma.groupMember.update({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId,
        },
      },
      data: { status: 'removed' },
    });

    return { success: true };
  }

  private async checkGroupPermission(
    groupId: string,
    userId: string,
    allowedRoles: string[],
  ) {
    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!member || member.status !== 'active') {
      throw new ForbiddenException('Not a member');
    }

    if (!allowedRoles.includes(member.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private async checkMembership(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!member || member.status !== 'active') {
      throw new ForbiddenException('Not a member');
    }
  }
}
