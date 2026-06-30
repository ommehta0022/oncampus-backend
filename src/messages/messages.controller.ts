import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { MessagesService } from './messages.service';
import { SendMessageDto, EditMessageDto } from './dto/messages.dto';

@Controller('groups/:groupId/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post()
  async sendMessage(
    @CurrentUser() user: any,
    @Param('groupId') groupId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(groupId, user.userId, dto);
  }

  @Get()
  async getMessages(
    @CurrentUser() user: any,
    @Param('groupId') groupId: string,
    @Query('after') after?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.messagesService.getMessages(groupId, user.userId, after, limit);
  }

  @Patch(':messageId')
  async editMessage(
    @CurrentUser() user: any,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.messagesService.editMessage(messageId, user.userId, dto.content);
  }

  @Delete(':messageId')
  async deleteMessage(
    @CurrentUser() user: any,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.deleteMessage(messageId, user.userId);
  }
}
