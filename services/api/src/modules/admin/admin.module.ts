import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminAccessGuard } from '../../common/admin/admin-access.guard';
import { AdminAuditService } from '../../common/admin/admin-audit.service';
import { AdminRolesGuard } from '../../common/admin/admin-roles.guard';
import { ReferralsModule } from '../referrals/referrals.module';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminOpsController } from './admin-ops.controller';
import { AdminOpsService } from './admin-ops.service';

@Module({
  imports: [JwtModule.register({}), WalletModule, ReferralsModule, NotificationsModule],
  controllers: [AdminAuthController, AdminOpsController],
  providers: [AdminAuthService, AdminOpsService, AdminAccessGuard, AdminRolesGuard, AdminAuditService]
})
export class AdminModule {}
