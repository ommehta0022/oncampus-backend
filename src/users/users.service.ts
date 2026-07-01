import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { SupabaseService } from '@/common/supabase/supabase.service';
import { UpdateProfileDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        city: true,
        course: true,
        avatarUrl: true,
        verified: true,
        status: true,
        createdAt: true,
        lastSeenAt: true,
        institutions: {
          include: {
            institution: {
              select: {
                id: true,
                name: true,
                city: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...user,
      institutions: user.institutions.map(ui => ({
        ...ui.institution,
        verificationStatus: ui.verificationStatus,
        verifiedAt: ui.verifiedAt,
      })),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        city: dto.city,
        course: dto.course,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        city: true,
        course: true,
        avatarUrl: true,
        verified: true,
      },
    });

    return user;
  }

  async addInstitution(userId: string, institutionId: string) {
    // Check if already added
    const existing = await this.prisma.userInstitution.findUnique({
      where: {
        userId_institutionId: {
          userId,
          institutionId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Institution already added');
    }

    // Create pending verification
    const userInstitution = await this.prisma.userInstitution.create({
      data: {
        userId,
        institutionId,
        verificationStatus: 'pending',
      },
      include: {
        institution: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
    });

    return userInstitution;
  }

  async updateAvatar(userId: string, file: Buffer, contentType: string) {
    const fileName = `${userId}-${Date.now()}.jpg`;
    const filePath = `avatars/${fileName}`;

    // Upload to Supabase Storage
    const { url } = await this.supabase.uploadFile(
      'avatars',
      filePath,
      file,
      {
        contentType,
        cacheControl: '3600',
        upsert: true,
      },
    );

    // Update user avatar URL
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: url },
    });

    return { avatarUrl: url };
  }

  async registerPushToken(userId: string, deviceId: string, pushToken: string, platform: string) {
    const existingDevice = await this.prisma.userDevice.findUnique({
      where: { id: deviceId },
      select: { userId: true },
    });

    if (existingDevice && existingDevice.userId !== userId) {
      throw new BadRequestException('Device belongs to another user');
    }

    await this.prisma.userDevice.upsert({
      where: { id: deviceId },
      create: {
        id: deviceId,
        userId,
        platform,
        pushToken,
        trusted: true,
      },
      update: {
        pushToken,
        lastSeenAt: new Date(),
      },
    });

    return { success: true };
  }

  async getDevices(userId: string) {
    const devices = await this.prisma.userDevice.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      select: {
        id: true,
        platform: true,
        trusted: true,
        lastSeenAt: true,
        createdAt: true,
      },
      orderBy: {
        lastSeenAt: 'desc',
      },
    });

    return devices;
  }

  async revokeDevice(userId: string, deviceId: string) {
    const result = await this.prisma.userDevice.updateMany({
      where: { id: deviceId, userId },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      throw new NotFoundException('Device not found');
    }

    // Also revoke refresh tokens for this device
    await this.prisma.refreshToken.updateMany({
      where: { userId, deviceId },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  async updateLastSeen(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });
  }
}
