import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewReportDto {
  @IsIn(['reviewing', 'resolved', 'dismissed'])
  status!: 'reviewing' | 'resolved' | 'dismissed';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
