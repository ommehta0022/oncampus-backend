import { Controller, Get, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('app/update')
export class AppUpdateController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  check(
    @Query('platform') platform = 'android',
    @Query('version') version = '0.0.0',
    @Query('build') build = '0',
  ) {
    const latestVersion = this.configService.get('APP_LATEST_VERSION') || version;
    const latestBuild = this.numberConfig('APP_LATEST_BUILD', Number.parseInt(build, 10) || 0);
    const minimumBuild = this.numberConfig('APP_MIN_BUILD', 0);
    const releaseNotes = this.listConfig('APP_UPDATE_NOTES');
    const message =
      this.configService.get('APP_UPDATE_MESSAGE') ||
      'A newer version of OnCampus is available with improvements and fixes.';

    return {
      latestVersion,
      latestBuild,
      minimumBuild,
      title: this.configService.get('APP_UPDATE_TITLE') || 'Update OnCampus',
      message,
      releaseNotes,
      force: latestBuild > 0 && (Number.parseInt(build, 10) || 0) < minimumBuild,
      android: {
        latestVersion,
        latestBuild,
        minimumBuild,
        storeUrl:
          this.configService.get('ANDROID_UPDATE_URL') ||
          'market://details?id=com.oncampus.app',
      },
      ios: {
        latestVersion,
        latestBuild,
        minimumBuild,
        storeUrl: this.configService.get('IOS_UPDATE_URL') || '',
      },
      platform,
    };
  }

  private numberConfig(key: string, fallback: number): number {
    const value = Number.parseInt(this.configService.get(key) || '', 10);
    return Number.isFinite(value) ? value : fallback;
  }

  private listConfig(key: string): string[] {
    return (this.configService.get(key) || '')
      .split('|')
      .map((item: string) => item.trim())
      .filter(Boolean);
  }
}
