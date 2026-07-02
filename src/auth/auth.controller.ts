import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  StartPhoneAuthDto,
  VerifyPhoneOtpDto,
  RefreshTokenDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('otp/verify-dev')
  @HttpCode(HttpStatus.OK)
  async verifyOtpDev(
    @Body() body: { phone: string; code: string },
    @Headers('x-device-id') deviceId: string,
  ) {
    // Dev mode: accepts hardcoded OTP code without Firebase
    const devCode = process.env.DEV_OTP_CODE || '123456';
    const devMode = process.env.DEV_MODE === 'true';

    if (!devMode) {
      throw new Error('Dev OTP endpoint is disabled in production');
    }

    if (body.code !== devCode) {
      throw new Error(`Invalid OTP. Expected: ${devCode}`);
    }

    return this.authService.verifyDevOtp(
      body.phone,
      deviceId || 'dev-device',
    );
  }

  @Post('otp/start')
  @HttpCode(HttpStatus.OK)
  async startPhoneAuth(
    @Body() dto: StartPhoneAuthDto,
    @Headers('x-device-id') deviceId: string,
  ) {
    if (!deviceId) {
      throw new Error('Device ID required');
    }

    return this.authService.startPhoneAuth(dto.phone, deviceId);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyPhoneOtpDto,
    @Headers('x-device-id') deviceId: string,
  ) {
    if (!deviceId) {
      throw new Error('Device ID required');
    }

    return this.authService.verifyPhoneOtp(
      dto.challengeId,
      dto.firebaseIdToken,
      deviceId,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Headers('x-device-id') deviceId: string,
  ) {
    if (!deviceId) {
      throw new Error('Device ID required');
    }

    return this.authService.refreshTokens(dto.refreshToken, deviceId);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: any,
    @Headers('x-device-id') deviceId: string,
  ) {
    await this.authService.revokeToken(user.userId, deviceId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any) {
    return this.authService.validateUser(user.userId);
  }
}
