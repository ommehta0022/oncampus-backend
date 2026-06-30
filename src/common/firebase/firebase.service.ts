import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    try {
      const projectId = this.configService.get('FIREBASE_PROJECT_ID');
      const privateKey = this.configService.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
      const clientEmail = this.configService.get('FIREBASE_CLIENT_EMAIL');

      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey,
          clientEmail,
        }),
      });

      this.logger.log('✅ Firebase Admin initialized');
    } catch (error) {
      this.logger.error('❌ Firebase initialization failed', error);
      throw error;
    }
  }

  getAuth(): admin.auth.Auth {
    return this.app.auth();
  }

  getMessaging(): admin.messaging.Messaging {
    return this.app.messaging();
  }

  // Phone OTP via Firebase Auth
  async verifyPhoneToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    return this.getAuth().verifyIdToken(idToken);
  }

  async getUserByPhone(phoneNumber: string): Promise<admin.auth.UserRecord | null> {
    try {
      return await this.getAuth().getUserByPhoneNumber(phoneNumber);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return null;
      }
      throw error;
    }
  }

  async createUserWithPhone(phoneNumber: string): Promise<admin.auth.UserRecord> {
    return this.getAuth().createUser({ phoneNumber });
  }

  // Push Notifications
  async sendPushNotification(
    token: string,
    notification: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ): Promise<string> {
    const message: admin.messaging.Message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      android: {
        priority: 'high',
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    };

    return this.getMessaging().send(message);
  }

  async sendMulticastPushNotification(
    tokens: string[],
    notification: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ): Promise<admin.messaging.BatchResponse> {
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      android: {
        priority: 'high',
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    };

    return this.getMessaging().sendEachForMulticast(message);
  }

  async verifyPushToken(token: string): Promise<boolean> {
    try {
      await this.getMessaging().send({ token }, true); // Dry run
      return true;
    } catch (error) {
      return false;
    }
  }
}
