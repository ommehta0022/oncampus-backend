import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

@Injectable()
export class DiscoveryService {
  constructor(private prisma: PrismaService) {}

  async discoverGroups(
    userId: string,
    filters: {
      institutionId?: string;
      city?: string;
      category?: string;
      q?: string;
    },
  ) {
    const where: any = {
      visibility: 'public',
      deletedAt: null,
    };

    if (filters.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters.city) {
      where.city = filters.city;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.q) {
      where.OR = [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { description: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    const groups = await this.prisma.group.findMany({
      where,
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
      orderBy: [
        { official: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 50,
    });

    // Get user's join request status for each group
    const groupIds = groups.map(g => g.id);
    const joinRequests = await this.prisma.joinRequest.findMany({
      where: {
        userId,
        groupId: { in: groupIds },
      },
      select: {
        groupId: true,
        status: true,
      },
    });

    const memberships = await this.prisma.groupMember.findMany({
      where: {
        userId,
        groupId: { in: groupIds },
      },
      select: {
        groupId: true,
        status: true,
      },
    });

    const requestMap = new Map(joinRequests.map(r => [r.groupId, r.status]));
    const memberMap = new Map(memberships.map(m => [m.groupId, m.status]));

    return groups.map(g => ({
      ...g,
      memberCount: g._count.members,
      userJoinStatus: requestMap.get(g.id) || null,
      userMemberStatus: memberMap.get(g.id) || null,
      isMember: memberMap.has(g.id) && memberMap.get(g.id) === 'active',
    }));
  }

  async getInstitutions(city?: string) {
    const where: any = {};

    if (city) {
      where.city = city;
    }

    const institutions = await this.prisma.institution.findMany({
      where,
      include: {
        _count: {
          select: {
            groups: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return institutions;
  }

  async searchUsers(query: string, limit: number = 20) {
    // Only search verified users
    const users = await this.prisma.user.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
        verified: true,
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        city: true,
        verified: true,
        avatarUrl: true,
      },
      take: limit,
    });

    return users;
  }
}
