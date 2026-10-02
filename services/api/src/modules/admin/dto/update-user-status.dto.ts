import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserStatusDto {
  @IsIn(['active', 'suspended', 'banned'])
  status!: 'active' | 'suspended' | 'banned';

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  duration?: string;
}
