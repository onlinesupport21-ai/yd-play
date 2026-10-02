import { Body, Controller, Get, Ip, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentAdmin } from '../../common/admin/admin-current.decorator';
import { AdminAccessGuard } from '../../common/admin/admin-access.guard';
import { AdminRoles } from '../../common/admin/admin-roles.decorator';
import { AdminRolesGuard } from '../../common/admin/admin-roles.guard';
import { AdminPrincipal } from '../../common/admin/admin.types';
import { UpdateReferralConfigDto } from '../referrals/dto/update-referral-config.dto';
import { ReviewFlagDto } from '../referrals/dto/review-flag.dto';
import { AdminOpsService } from './admin-ops.service';
import { CoinAdjustmentDto } from './dto/coin-adjustment.dto';
import { CreatePushCampaignDto } from './dto/create-push-campaign.dto';
import { ReviewReportDto } from './dto/review-report.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Controller('admin')
@UseGuards(AdminAccessGuard, AdminRolesGuard)
export class AdminOpsController {
  constructor(private readonly ops: AdminOpsService) {}

  @Get('me')
  me(@CurrentAdmin() admin: AdminPrincipal) { return this.ops.me(admin); }

  @Get('dashboard')
  @AdminRoles('analyst','operator','admin','super_admin','support','moderator')
  dashboard() { return this.ops.dashboard(); }

  @Get('users')
  @AdminRoles('support','moderator','operator','admin','super_admin')
  users(@Query('q') q = '', @Query('limit') limit = '50') {
    return this.ops.listUsers(q, Number(limit));
  }

  @Get('users/:userId')
  @AdminRoles('support','moderator','operator','admin','super_admin')
  user(@Param('userId') userId: string) { return this.ops.userDetail(userId); }

  @Patch('users/:userId/status')
  @AdminRoles('moderator','admin','super_admin')
  status(@CurrentAdmin() admin: AdminPrincipal, @Param('userId') userId: string, @Body() dto: UpdateUserStatusDto, @Ip() ip: string) {
    return this.ops.updateUserStatus(admin, userId, dto, ip);
  }

  @Post('users/:userId/coins')
  @AdminRoles('operator','admin','super_admin')
  coins(@CurrentAdmin() admin: AdminPrincipal, @Param('userId') userId: string, @Body() dto: CoinAdjustmentDto, @Ip() ip: string) {
    return this.ops.adjustCoins(admin, userId, dto, ip);
  }

  @Get('economy')
  @AdminRoles('analyst','operator','admin','super_admin')
  economy(@Query('days') days = '7') { return this.ops.economy(Number(days)); }

  @Get('analytics/events')
  @AdminRoles('analyst','operator','admin','super_admin')
  analyticsEvents(@Query('days') days = '7') { return this.ops.analyticsEvents(Number(days)); }

  @Get('moderation/reports')
  @AdminRoles('moderator','admin','super_admin','support')
  reports(@Query('status') status = 'open', @Query('limit') limit = '50') { return this.ops.reports(status, Number(limit)); }

  @Patch('moderation/reports/:reportId')
  @AdminRoles('moderator','admin','super_admin')
  reviewReport(@CurrentAdmin() admin: AdminPrincipal, @Param('reportId') reportId: string, @Body() dto: ReviewReportDto, @Ip() ip: string) {
    return this.ops.reviewReport(admin, reportId, dto, ip);
  }

  @Get('referrals/config')
  @AdminRoles('analyst','operator','admin','super_admin')
  referralConfig() { return this.ops.referralConfig(); }

  @Patch('referrals/config')
  @AdminRoles('operator','admin','super_admin')
  referralConfigUpdate(@CurrentAdmin() admin: AdminPrincipal, @Body() dto: UpdateReferralConfigDto, @Ip() ip: string) {
    return this.ops.updateReferralConfig(admin, dto, ip);
  }

  @Get('referrals/overview')
  @AdminRoles('analyst','operator','admin','super_admin')
  referralOverview() { return this.ops.referralOverview(); }

  @Get('fraud/flags')
  @AdminRoles('moderator','operator','admin','super_admin','analyst')
  fraud(@Query('status') status = 'open', @Query('limit') limit = '50') { return this.ops.fraudFlags(status, Number(limit)); }

  @Patch('fraud/flags/:flagId')
  @AdminRoles('moderator','admin','super_admin')
  reviewFraud(@CurrentAdmin() admin: AdminPrincipal, @Param('flagId') flagId: string, @Body() dto: ReviewFlagDto, @Ip() ip: string) {
    return this.ops.reviewFraudFlag(admin, flagId, dto.status, dto.reason, ip);
  }

  @Get('push-campaigns')
  @AdminRoles('operator','admin','super_admin','analyst')
  pushes(@Query('limit') limit = '50') { return this.ops.listPush(Number(limit)); }

  @Post('push-campaigns')
  @AdminRoles('operator','admin','super_admin')
  createPush(@CurrentAdmin() admin: AdminPrincipal, @Body() dto: CreatePushCampaignDto, @Ip() ip: string) {
    return this.ops.createPush(admin, dto, ip);
  }

  @Post('push-campaigns/:campaignId/dispatch')
  @AdminRoles('operator','admin','super_admin')
  dispatchPush(@CurrentAdmin() admin: AdminPrincipal, @Param('campaignId') campaignId: string, @Ip() ip: string) {
    return this.ops.dispatchPush(admin, campaignId, ip);
  }

  @Get('audit-logs')
  @AdminRoles('admin','super_admin')
  audit(@Query('limit') limit = '100') { return this.ops.auditLogs(Number(limit)); }
}
