import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '@/common/supabase/supabase.service';
import { nanoid } from 'nanoid';

@Injectable()
export class StorageService {
  constructor(
    private supabase: SupabaseService,
    private configService: ConfigService,
  ) {}

  async getSignedUploadUrl(
    userId: string,
    bucket: string,
    fileType: string,
    fileSize: number,
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
    const maxSize = (this.configService.get('MAX_UPLOAD_SIZE_MB') || 10) * 1024 * 1024;
    if (fileSize > maxSize) {
      throw new BadRequestException(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
    }

    // Generate unique file path
    const extension = fileType.split('/')[1];
    const fileName = `${nanoid()}.${extension}`;
    const filePath = `${bucket}/${userId}/${fileName}`;

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

  async getSignedDownloadUrl(bucket: string, filePath: string) {
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
