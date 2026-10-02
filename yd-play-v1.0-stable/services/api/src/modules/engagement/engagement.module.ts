import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { WalletModule } from '../wallet/wallet.module';
import { EngagementController } from './engagement.controller';
import { EngagementService } from './engagement.service';

@Module({
  imports:[JwtModule.register({}),WalletModule],
  controllers:[EngagementController],
  providers:[EngagementService,JwtAuthGuard],
  exports:[EngagementService]
})
export class EngagementModule {}
