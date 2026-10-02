import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength
} from 'class-validator';

export class RegisterDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_]+$/)
  @Length(3, 24)
  username!: string;

  @IsString()
  @Length(1, 40)
  displayName!: string;

  @IsString()
  @MinLength(10)
  password!: string;

  @IsIn(['android', 'ios', 'web'])
  platform!: 'android' | 'ios' | 'web';

  @IsString()
  @Length(4, 256)
  deviceProof!: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  appVersion?: string;

  @IsOptional()
  @IsString()
  @Length(4, 20)
  @Matches(/^[A-Za-z0-9]+$/)
  referralCode?: string;

  @IsBoolean()
  ageGateAccepted!: boolean;
}
