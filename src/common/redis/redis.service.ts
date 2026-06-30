import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get('REDIS_URL');

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          this.logger.error('Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    this.client.on('connect', () => {
      this.logger.log('✅ Redis connected');
    });

    this.client.on('error', (error) => {
      this.logger.error('❌ Redis error', error);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis disconnected');
  }

  getClient(): Redis {
    return this.client;
  }

  // Presence Management
  async setUserOnline(userId: string, socketId: string, deviceId: string): Promise<void> {
    await this.client.sadd(`presence:user:${userId}`, socketId);
    await this.client.hset(`socket:${socketId}`, {
      userId,
      deviceId,
      connectedAt: Date.now(),
    });
    await this.client.expire(`socket:${socketId}`, 3600);
  }

  async setUserOffline(userId: string, socketId: string): Promise<void> {
    await this.client.srem(`presence:user:${userId}`, socketId);
    await this.client.del(`socket:${socketId}`);
  }

  async isUserOnline(userId: string): Promise<boolean> {
    const sockets = await this.client.smembers(`presence:user:${userId}`);
    return sockets.length > 0;
  }

  async getUserSockets(userId: string): Promise<string[]> {
    return this.client.smembers(`presence:user:${userId}`);
  }

  async addUserToGroup(socketId: string, groupId: string): Promise<void> {
    const socketData = await this.client.hgetall(`socket:${socketId}`);
    if (!socketData.userId) return;

    await this.client.sadd(`presence:group:${groupId}`, socketId);
    await this.client.sadd(`socket:${socketId}:groups`, groupId);
  }

  async removeUserFromGroup(socketId: string, groupId: string): Promise<void> {
    await this.client.srem(`presence:group:${groupId}`, socketId);
    await this.client.srem(`socket:${socketId}:groups`, groupId);
  }

  async getGroupSockets(groupId: string): Promise<string[]> {
    return this.client.smembers(`presence:group:${groupId}`);
  }

  // Rate Limiting
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const current = await this.client.incr(key);

    if (current === 1) {
      await this.client.expire(key, windowSeconds);
    }

    return current <= limit;
  }

  async getRateLimitRemaining(key: string, limit: number): Promise<number> {
    const current = await this.client.get(key);
    return limit - (parseInt(current || '0', 10));
  }

  // Caching
  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  // OTP Management
  async storeOtp(challengeId: string, data: any, ttlSeconds: number = 300): Promise<void> {
    await this.set(`otp:${challengeId}`, data, ttlSeconds);
  }

  async getOtp(challengeId: string): Promise<any> {
    return this.get(`otp:${challengeId}`);
  }

  async deleteOtp(challengeId: string): Promise<void> {
    await this.del(`otp:${challengeId}`);
  }

  // Session Management
  async storeSession(sessionId: string, data: any, ttlSeconds: number = 86400): Promise<void> {
    await this.set(`session:${sessionId}`, data, ttlSeconds);
  }

  async getSession(sessionId: string): Promise<any> {
    return this.get(`session:${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.del(`session:${sessionId}`);
  }

  // Pub/Sub
  async publish(channel: string, message: any): Promise<void> {
    await this.client.publish(channel, JSON.stringify(message));
  }

  subscribe(channel: string, callback: (message: any) => void): void {
    const subscriber = this.client.duplicate();
    subscriber.subscribe(channel);
    subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        callback(JSON.parse(message));
      }
    });
  }
}
