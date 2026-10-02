import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Query,
  UseGuards
} from '@nestjs/common';
import { AdminApiKeyGuard } from '../../common/admin/admin-api-key.guard';
import { AdminAuditService } from '../../common/admin/admin-audit.service';
import { ReferralsService } from './referrals.service';
import { UpdateReferralConfigDto } from './dto/update-referral-config.dto';
import { ReviewFlagDto } from './dto/review-flag.dto';
import { ReferralDecisionDto } from './dto/referral-decision.dto';

@Controller('admin/referrals')
@UseGuards(AdminApiKeyGuard)
export class ReferralAdminController {
  constructor(
    private readonly referrals: ReferralsService,
    private readonly audit: AdminAuditService
  ) {}

  @Get('config')
  config() {
    return this.referrals.getAdminConfig();
  }

  @Patch('config')
  async updateConfig(@Body() dto: UpdateReferralConfigDto, @Ip() ip: string) {
    const result = await this.referrals.updateAdminConfig(dto);
    await this.audit.write({
      action: 'referral.config.update',
      targetType: 'referral_program',
      targetId: result.after.id,
      ip,
      beforeState: result.before,
      afterState: result.after
    });
    return result.after;
  }

  @Get('fraud-flags')
  flags(
    @Query('status') status = 'open',
    @Query('limit') limitRaw?: string
  ) {
    const parsed = Number(limitRaw ?? '50');
    const limit = Number.isFinite(parsed) ? Math.trunc(parsed) : 50;
    return this.referrals.listFraudFlags(status, limit);
  }

  @Patch('fraud-flags/:flagId')
  async reviewFlag(
    @Param('flagId') flagId: string,
    @Body() dto: ReviewFlagDto,
    @Ip() ip: string
  ) {
    const updated = await this.referrals.reviewFraudFlag(flagId, dto.status);
    await this.audit.write({
      action: 'referral.fraud_flag.review',
      targetType: 'referral_abuse_flag',
      targetId: flagId,
      ip,
      afterState: updated,
      reason: dto.reason
    });
    return updated;
  }

  @Patch(':referralId/decision')
  async decision(
    @Param('referralId') referralId: string,
    @Body() dto: ReferralDecisionDto,
    @Ip() ip: string
  ) {
    const after = await this.referrals.adminDecision(referralId, dto.decision, dto.reason);
    await this.audit.write({
      action: `referral.review.${dto.decision}`,
      targetType: 'referral',
      targetId: referralId,
      ip,
      afterState: after,
      reason: dto.reason
    });
    return after;
  }

  @Get('overview')
  overview() {
    return this.referrals.adminOverview();
  }
}
