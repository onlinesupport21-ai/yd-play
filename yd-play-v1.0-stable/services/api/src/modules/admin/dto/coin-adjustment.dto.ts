import { IsIn, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CoinAdjustmentDto {
  @IsIn(['credit', 'debit'])
  direction!: 'credit' | 'debit';

  @IsInt()
  @Min(1)
  @Max(1000000)
  amount!: number;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
