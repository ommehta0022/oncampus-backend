import { IsString, IsPhoneNumber, Length } from 'class-validator';

export class StartPhoneAuthDto {
  @IsPhoneNumber()
  phone: string;
}

export class VerifyPhoneOtpDto {
  @IsString()
  @Length(10, 50)
  challengeId: string;

  @IsString()
  firebaseIdToken: string;
}

export class RefreshTokenDto {
  @IsString()
  @Length(64, 64)
  refreshToken: string;
}
