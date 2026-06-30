import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { GroupsService } from './groups.service';
import { CreateGroupDto, UpdateGroupDto, UpdateMemberRoleDto } from './dto/groups.dto';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Post()
  async createGroup(@CurrentUser() user: any, @Body() dto: CreateGroupDto) {
    return this.groupsService.createGroup(user.userId, dto);
  }

  @Get()
  async getUserGroups(@CurrentUser() user: any) {
    return this.groupsService.getUserGroups(user.userId);
  }

  @Get(':groupId')
  async getGroup(@CurrentUser() user: any, @Param('groupId') groupId: string) {
    return this.groupsService.getGroup(groupId, user.userId);
  }

  @Patch(':groupId')
  async updateGroup(
    @CurrentUser() user: any,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.updateGroup(groupId, user.userId, dto);
  }

  @Delete(':groupId')
  async deleteGroup(@CurrentUser() user: any, @Param('groupId') groupId: string) {
    return this.groupsService.deleteGroup(groupId, user.userId);
  }

  @Post(':groupId/join-requests')
  async createJoinRequest(@CurrentUser() user: any, @Param('groupId') groupId: string) {
    return this.groupsService.createJoinRequest(groupId, user.userId);
  }

  @Get(':groupId/join-requests')
  async getJoinRequests(@CurrentUser() user: any, @Param('groupId') groupId: string) {
    return this.groupsService.getJoinRequests(groupId, user.userId);
  }

  @Post(':groupId/join-requests/:requestId/approve')
  async approveJoinRequest(
    @CurrentUser() user: any,
    @Param('groupId') groupId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.groupsService.approveJoinRequest(groupId, requestId, user.userId);
  }

  @Post(':groupId/join-requests/:requestId/reject')
  async rejectJoinRequest(
    @CurrentUser() user: any,
    @Param('groupId') groupId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.groupsService.rejectJoinRequest(groupId, requestId, user.userId);
  }

  @Delete(':groupId/membership')
  async leaveGroup(@CurrentUser() user: any, @Param('groupId') groupId: string) {
    return this.groupsService.leaveGroup(groupId, user.userId);
  }

  @Get(':groupId/members')
  async getMembers(@CurrentUser() user: any, @Param('groupId') groupId: string) {
    return this.groupsService.getMembers(groupId, user.userId);
  }

  @Patch(':groupId/members/:memberId/role')
  async updateMemberRole(
    @CurrentUser() user: any,
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.groupsService.updateMemberRole(groupId, memberId, dto.role, user.userId);
  }

  @Delete(':groupId/members/:memberId')
  async removeMember(
    @CurrentUser() user: any,
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.groupsService.removeMember(groupId, memberId, user.userId);
  }
}
