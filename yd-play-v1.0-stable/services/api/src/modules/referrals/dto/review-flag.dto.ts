import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class ReviewFlagDto {
  @IsIn(['reviewing', 'confirmed', 'dismissed'])
  status!: 'reviewing' | 'confirmed' | 'dismissed';

  @IsOptional()
  @IsString()
  @Length(3, 300)
  reason?: string;
}
