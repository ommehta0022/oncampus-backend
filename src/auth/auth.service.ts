import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';
import { FirebaseService } from '@/common/firebase/firebase.service';
import * as crypto from 'crypto';
import { nanoid } from 'nanoid';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private firebase: FirebaseService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // Phone OTP flow via Firebase
  async startPhoneAuth(phone: string, deviceId: string) {
    // Rate limit check
    const rateLimitKey = `otp:rate:${phone}`;
    const canProceed = await this.redis.checkRateLimit(rateLimitKey, 5, 3600);

    if (!canProceed) {
      throw new BadRequestException('Too many OTP requests. Try again later.');
    }

    // Generate challenge ID
    const challengeId = nanoid();

    // Store challenge in Redis
    await this.redis.storeOtp(challengeId, {
      phone,
      deviceId,
      attempts: 0,
      createdAt: Date.now(),
    }, 300); // 5 minutes

    // In production, Firebase handles OTP sending on client side
    // This just returns the challenge ID for verification later
    return {
      challengeId,
      expiresInSeconds: 300,
      message: 'OTP will be sent via Firebase Auth on client side',
    };
  }

  async verifyPhoneOtp(challengeId: string, firebaseIdToken: string, deviceId: string) {
    // Get challenge from Redis
    const challenge = await this.redis.getOtp(challengeId);
    if (!challenge) {
      throw new BadRequestException('Invalid or expired challenge');
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await this.firebase.verifyPhoneToken(firebaseIdToken);
    } catch (error) {
      this.logger.error('Firebase token verification failed', error);
      throw new UnauthorizedException('Invalid Firebase token');
    }

    const phone = decodedToken.phone_number;
    if (!phone) {
      throw new UnauthorizedException('Phone number not found in token');
    }

    // Check if device matches
    if (challenge.deviceId !== deviceId) {
      throw new UnauthorizedException('Device mismatch');
    }

    // Clean up challenge
    await this.redis.deleteOtp(challengeId);

    // Hash phone for storage
    const phoneHash = this.hashPhone(phone);

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { phoneHash },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phoneHash,
          verified: false,
        },
      });
      this.logger.log(`New user created: ${user.id}`);
    }

    // Create or update device
    await this.prisma.userDevice.upsert({
      where: { id: deviceId },
      create: {
        id: deviceId,
        userId: user.id,
        platform: decodedToken.firebase?.sign_in_provider || 'unknown',
        trusted: true,
      },
      update: {
        lastSeenAt: new Date(),
        revokedAt: null,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, deviceId);

    return {
      userId: user.id,
      isNewUser: !user.name,
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string, deviceId: string) {
    const tokenHash = this.hashToken(refreshToken);

    // Find refresh token
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!storedToken || storedToken.revokedAt) {
      // Token reuse detection - revoke entire family
      if (storedToken?.family) {
        await this.prisma.refreshToken.updateMany({
          where: { family: storedToken.family },
          data: { revokedAt: new Date() },
        });
        this.logger.warn(`Token reuse detected for family: ${storedToken.family}`);
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check expiration
    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Check device match
    if (storedToken.deviceId !== deviceId) {
      throw new UnauthorizedException('Device mismatch');
    }

    // Revoke current token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });

    // Generate new tokens
    const tokens = await this.generateTokens(storedToken.userId, deviceId, storedToken.family);

    return tokens;
  }

  async revokeToken(userId: string, deviceId?: string) {
    if (deviceId) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, deviceId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  async validateUser(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        city: true,
        verified: true,
        status: true,
        avatarUrl: true,
      },
    });

    if (!user || user.status === 'banned') {
      throw new UnauthorizedException('User not found or banned');
    }

    return user;
  }

  private async generateTokens(userId: string, deviceId: string, family?: string) {
    // Generate access token
    const accessToken = this.jwtService.sign(
      { sub: userId, deviceId },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN') || '15m',
      },
    );

    // Generate refresh token
    const refreshToken = nanoid(64);
    const tokenHash = this.hashToken(refreshToken);
    const tokenFamily = family || nanoid(32);

    // Store refresh token
    await this.prisma.refreshToken.create({
      data: {
        userId,
        deviceId,
        tokenHash,
        family: tokenFamily,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  private hashPhone(phone: string): string {
    return crypto.createHash('sha256').update(phone).digest('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
