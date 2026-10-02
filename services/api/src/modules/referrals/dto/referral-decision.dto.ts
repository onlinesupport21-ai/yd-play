import { IsIn, IsString, Length } from 'class-validator';

export class ReferralDecisionDto {
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';

  @IsString()
  @Length(3, 300)
  reason!: string;
}
