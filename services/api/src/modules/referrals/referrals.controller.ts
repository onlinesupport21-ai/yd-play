import { Body, Controller, Get, Ip, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessTokenPayload } from '../../common/auth/auth.types';
import { ReferralsService } from './referrals.service';
import { ApplyReferralDto } from './dto/apply-referral.dto';

@Controller('referrals')
@UseGuards(JwtAuthGuard)
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('me')
  summary(@CurrentUser() user: AccessTokenPayload) {
    return this.referrals.getSummary(user.sub);
  }

  @Post('apply')
  apply(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: ApplyReferralDto,
    @Ip() ip: string
  ) {
    return this.referrals.applyCode(user.sub, dto.code, ip);
  }

  @Post('evaluate')
  evaluate(@CurrentUser() user: AccessTokenPayload) {
    return this.referrals.evaluateForInvitee(user.sub);
  }
}
