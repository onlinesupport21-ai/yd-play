import { IsIn, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(3, 320)
  identifier!: string;

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
}
