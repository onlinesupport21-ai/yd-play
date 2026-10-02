import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WalletModule } from '../wallet/wallet.module';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ReferralsModule } from '../referrals/referrals.module';

@Module({
  imports: [JwtModule.register({}), WalletModule, ReferralsModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule]
})
export class AuthModule {}
