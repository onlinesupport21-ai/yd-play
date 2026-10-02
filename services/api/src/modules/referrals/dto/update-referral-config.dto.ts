import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateReferralConfigDto {
  @IsOptional() @IsInt() @Min(0) inviterReward?: number;
  @IsOptional() @IsInt() @Min(0) inviteeReward?: number;
  @IsOptional() @IsInt() @Min(0) dailyInviterRewardCap?: number;
  @IsOptional() @IsInt() @Min(0) lifetimeInviterRewardCap?: number;
  @IsOptional() @IsInt() @Min(0) minAccountAgeMinutes?: number;
  @IsOptional() @IsInt() @Min(1) maxInvitesPerHour?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) sameDeviceRisk?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) sameIpRisk?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) ipVelocityRisk?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) deviceMultiAccountRisk?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) inviterVelocityRisk?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) reviewThreshold?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) blockThreshold?: number;
}
