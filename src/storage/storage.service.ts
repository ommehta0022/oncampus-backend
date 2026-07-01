import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';
import { SupabaseService } from '@/common/supabase/supabase.service';
import { nanoid } from 'nanoid';

@Injectable()
export class StorageService {
  constructor(
    private supabase: SupabaseService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async getSignedUploadUrl(
    userId: string,
    bucket: string,
    fileType: string,
    fileSize: number,
    groupId?: string,
  ) {
    // Validate file type
    const allowedTypes = this.configService.get('ALLOWED_UPLOAD_TYPES')?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];

    if (!allowedTypes.includes(fileType)) {
      throw new BadRequestException('File type not allowed');
    }

    // Validate file size (10MB default)
    const maxSize = Number(this.configService.get('MAX_UPLOAD_SIZE_MB') || 10) * 1024 * 1024;
    if (fileSize > maxSize) {
      throw new BadRequestException(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
    }

    // Generate unique file path
    const extension = fileType.split('/')[1];
    const fileName = `${nanoid()}.${extension}`;
    let filePath: string;
    if (bucket === 'avatars') {
      filePath = `${userId}/${fileName}`;
    } else if (bucket === 'group-media') {
      if (!groupId) {
        throw new BadRequestException('groupId is required for group media');
      }

      const member = await this.prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });

      if (!member || member.status !== 'active') {
        throw new ForbiddenException('Not a member of this group');
      }

      filePath = `${groupId}/${userId}/${fileName}`;
    } else {
      throw new BadRequestException('Invalid bucket');
    }

    // Get signed upload URL from Supabase
    const signedUrl = await this.supabase.getSignedUploadUrl(
      bucket,
      filePath,
      parseInt(this.configService.get('SIGNED_URL_EXPIRES_IN') || '3600'),
    );

    return {
      uploadUrl: signedUrl,
      filePath,
      expiresIn: 3600,
    };
  }

  async getSignedDownloadUrl(userId: string, bucket: string, filePath: string) {
    if (bucket === 'avatars') {
      if (filePath.includes('..') || filePath.startsWith('/')) {
        throw new BadRequestException('Invalid avatar path');
      }
    } else if (bucket === 'group-media') {
      const parts = filePath.split('/');
      const groupId = parts[0];
      if (!groupId) {
        throw new BadRequestException('Invalid group media path');
      }

      const member = await this.prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });

      if (!member || member.status !== 'active') {
        throw new ForbiddenException('Not a member of this group');
      }
    } else {
      throw new BadRequestException('Invalid bucket');
    }

    const signedUrl = await this.supabase.getSignedUrl(bucket, filePath, 3600);
    return { url: signedUrl, expiresIn: 3600 };
  }

  async deleteFile(bucket: string, filePath: string) {
    await this.supabase.deleteFile(bucket, [filePath]);
    return { success: true };
  }

  getPublicUrl(bucket: string, filePath: string) {
    return this.supabase.getPublicUrl(bucket, filePath);
  }
}
