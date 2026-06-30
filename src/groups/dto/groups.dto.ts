import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  IsUUID,
  Length,
  Min,
  Max,
} from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @Length(3, 100)
  name: string;

  @IsOptional()
  @IsString()
  @Length(10, 500)
  description?: string;

  @IsString()
  @Length(2, 100)
  city: string;

  @IsString()
  @IsIn([
    'exam_prep',
    'sports',
    'cultural',
    'technical',
    'academic',
    'social',
    'events',
    'housing',
    'marketplace',
    'other',
  ])
  category: string;

  @IsString()
  @IsIn(['public', 'private'])
  visibility: string;

  @IsString()
  @IsIn(['request_to_join', 'auto_approve_verified', 'invite_only'])
  joinPolicy: string;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(100000)
  memberLimit?: number;

  @IsOptional()
  @IsUUID()
  institutionId?: string;
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @Length(3, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(10, 500)
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn([
    'exam_prep',
    'sports',
    'cultural',
    'technical',
    'academic',
    'social',
    'events',
    'housing',
    'marketplace',
    'other',
  ])
  category?: string;

  @IsOptional()
  @IsString()
  @IsIn(['public', 'private'])
  visibility?: string;

  @IsOptional()
  @IsString()
  @IsIn(['request_to_join', 'auto_approve_verified', 'invite_only'])
  joinPolicy?: string;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(100000)
  memberLimit?: number;
}

export class UpdateMemberRoleDto {
  @IsString()
  @IsIn(['admin', 'moderator', 'member'])
  role: string;
}
