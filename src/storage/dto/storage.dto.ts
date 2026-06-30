import { IsString, IsNumber, IsIn, Min, Max } from 'class-validator';

export class GetSignedUploadUrlDto {
  @IsString()
  @IsIn(['avatars', 'group-media'])
  bucket: string;

  @IsString()
  fileType: string;

  @IsNumber()
  @Min(1)
  @Max(10 * 1024 * 1024) // 10MB
  fileSize: number;
}
