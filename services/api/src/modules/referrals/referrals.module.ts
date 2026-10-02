import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WalletModule } from '../wallet/wallet.module';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AdminApiKeyGuard } from '../../common/admin/admin-api-key.guard';
import { AdminAuditService } from '../../common/admin/admin-audit.service';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';
import { ReferralAdminController } from './referral-admin.controller';

@Module({
  imports: [JwtModule.register({}), WalletModule],
  providers: [ReferralsService, JwtAuthGuard, AdminApiKeyGuard, AdminAuditService],
  controllers: [ReferralsController, ReferralAdminController],
  exports: [ReferralsService]
})
export class ReferralsModule {}
