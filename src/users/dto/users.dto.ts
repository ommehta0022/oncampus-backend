import { IsString, IsOptional, IsIn, Length } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  city?: string;

  @IsOptional()
  @IsString()
  @Length(2, 200)
  course?: string;
}

export class RegisterPushTokenDto {
  @IsString()
  pushToken: string;

  @IsString()
  @IsIn(['ios', 'android'])
  platform: string;
}
