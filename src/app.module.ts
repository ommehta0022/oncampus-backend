import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

// Core modules
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { FirebaseModule } from './common/firebase/firebase.module';
import { SupabaseModule } from './common/supabase/supabase.module';

// Feature modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GroupsModule } from './groups/groups.module';
import { MessagesModule } from './messages/messages.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { WebSocketModule } from './websocket/websocket.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.production', '.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Scheduling (for cleanup tasks)
    ScheduleModule.forRoot(),

    // Core services
    PrismaModule,
    RedisModule,
    FirebaseModule,
    SupabaseModule,

    // Features
    AuthModule,
    UsersModule,
    GroupsModule,
    MessagesModule,
    DiscoveryModule,
    WebSocketModule,
    NotificationsModule,
    StorageModule,
  ],
})
export class AppModule {}
