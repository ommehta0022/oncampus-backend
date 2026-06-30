import { IsString, IsOptional, IsIn, IsUUID, Length } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @Length(1, 50)
  clientMessageId: string;

  @IsString()
  @IsIn(['text', 'image', 'file'])
  type: string;

  @IsOptional()
  @IsString()
  @Length(1, 5000)
  content?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  mediaType?: string;

  @IsOptional()
  @IsUUID()
  parentMessageId?: string;
}

export class EditMessageDto {
  @IsString()
  @Length(1, 5000)
  content: string;
}
