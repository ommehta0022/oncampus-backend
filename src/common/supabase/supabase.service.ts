import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get('SUPABASE_URL');
    const supabaseKey = this.configService.get('SUPABASE_SERVICE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.logger.log('✅ Supabase client initialized');
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  // Storage operations
  async uploadFile(
    bucket: string,
    path: string,
    file: Buffer | Blob,
    options?: {
      contentType?: string;
      cacheControl?: string;
      upsert?: boolean;
    },
  ): Promise<{ path: string; url: string }> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .upload(path, file, options);

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: urlData } = this.client.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return {
      path: data.path,
      url: urlData.publicUrl,
    };
  }

  async getSignedUploadUrl(
    bucket: string,
    path: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUploadUrl(path, {
        upsert: false,
      });

    if (error) {
      throw new Error(`Signed URL generation failed: ${error.message}`);
    }

    return data.signedUrl;
  }

  async getSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw new Error(`Signed URL generation failed: ${error.message}`);
    }

    return data.signedUrl;
  }

  async deleteFile(bucket: string, paths: string[]): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove(paths);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  async listFiles(bucket: string, path?: string): Promise<any[]> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .list(path || '', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      throw new Error(`List failed: ${error.message}`);
    }

    return data;
  }

  // Realtime subscriptions (for future use)
  subscribeToChannel(channelName: string) {
    return this.client.channel(channelName);
  }

  // Helper: Get public URL
  getPublicUrl(bucket: string, path: string): string {
    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }
}
