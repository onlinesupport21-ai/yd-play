import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateReportDto {
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsIn(['chat','profile','game','other'])
  sourceType!: 'chat'|'profile'|'game'|'other';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  details?: string;
}
