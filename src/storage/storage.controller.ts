import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { StorageService } from './storage.service';
import { GetSignedUploadUrlDto } from './dto/storage.dto';

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private storageService: StorageService) {}

  @Post('signed-upload-url')
  async getSignedUploadUrl(
    @CurrentUser() user: any,
    @Body() dto: GetSignedUploadUrlDto,
  ) {
    return this.storageService.getSignedUploadUrl(
      user.userId,
      dto.bucket,
      dto.fileType,
      dto.fileSize,
      dto.groupId,
    );
  }

  @Get('signed-download-url')
  async getSignedDownloadUrl(
    @CurrentUser() user: any,
    @Query('bucket') bucket: string,
    @Query('filePath') filePath: string,
  ) {
    return this.storageService.getSignedDownloadUrl(user.userId, bucket, filePath);
  }
}
