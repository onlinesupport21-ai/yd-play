import { IsInt, IsOptional, Min } from 'class-validator';

export class CompleteGameDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  claimedScore?: number;
}
