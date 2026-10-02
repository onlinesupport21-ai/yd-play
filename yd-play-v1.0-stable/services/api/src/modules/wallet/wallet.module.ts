import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  providers: [WalletService, JwtAuthGuard],
  controllers: [WalletController],
  exports: [WalletService]
})
export class WalletModule {}
