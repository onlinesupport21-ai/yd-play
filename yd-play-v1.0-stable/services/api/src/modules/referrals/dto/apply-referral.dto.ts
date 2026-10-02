import { IsString, Length, Matches } from 'class-validator';

export class ApplyReferralDto {
  @IsString()
  @Length(4, 20)
  @Matches(/^[A-Za-z0-9]+$/)
  code!: string;
}
