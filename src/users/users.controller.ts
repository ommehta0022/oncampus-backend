import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UseGuards,
  Headers,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto, RegisterPushTokenDto } from './dto/users.dto';

type UploadedAvatarFile = {
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    return this.usersService.getProfile(user.userId);
  }

  @Patch('me')
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async updateAvatar(
    @CurrentUser() user: any,
    @UploadedFile() file: UploadedAvatarFile,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images allowed');
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File size must be less than 5MB');
    }

    return this.usersService.updateAvatar(user.userId, file.buffer, file.mimetype);
  }

  @Post('me/institutions/:institutionId')
  async addInstitution(
    @CurrentUser() user: any,
    @Param('institutionId') institutionId: string,
  ) {
    return this.usersService.addInstitution(user.userId, institutionId);
  }

  @Post('me/push-token')
  async registerPushToken(
    @CurrentUser() user: any,
    @Headers('x-device-id') deviceId: string,
    @Body() dto: RegisterPushTokenDto,
  ) {
    if (!deviceId) {
      throw new BadRequestException('Device ID required');
    }

    return this.usersService.registerPushToken(
      user.userId,
      deviceId,
      dto.pushToken,
      dto.platform,
    );
  }

  @Get('me/devices')
  async getDevices(@CurrentUser() user: any) {
    return this.usersService.getDevices(user.userId);
  }

  @Post('me/devices/:deviceId/revoke')
  async revokeDevice(
    @CurrentUser() user: any,
    @Param('deviceId') deviceId: string,
  ) {
    return this.usersService.revokeDevice(user.userId, deviceId);
  }

  @Get(':userId')
  async getUserProfile(@Param('userId') userId: string) {
    return this.usersService.getProfile(userId);
  }
}
