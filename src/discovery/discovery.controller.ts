import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { DiscoveryService } from './discovery.service';

@Controller('discovery')
@UseGuards(JwtAuthGuard)
export class DiscoveryController {
  constructor(private discoveryService: DiscoveryService) {}

  @Get('groups')
  async discoverGroups(
    @CurrentUser() user: any,
    @Query('institutionId') institutionId?: string,
    @Query('city') city?: string,
    @Query('category') category?: string,
    @Query('q') q?: string,
  ) {
    return this.discoveryService.discoverGroups(user.userId, {
      institutionId,
      city,
      category,
      q,
    });
  }

  @Get('institutions')
  async getInstitutions(@Query('city') city?: string) {
    return this.discoveryService.getInstitutions(city);
  }

  @Get('users')
  async searchUsers(@Query('q') query: string) {
    return this.discoveryService.searchUsers(query);
  }
}
