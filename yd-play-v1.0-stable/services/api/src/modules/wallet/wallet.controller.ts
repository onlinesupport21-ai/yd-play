import { Controller, Get, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessTokenPayload } from '../../common/auth/auth.types';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallets: WalletService) {}

  @Get()
  async getWallet(@CurrentUser() user: AccessTokenPayload) {
    return this.wallets.getUserWallet(user.sub);
  }

  @Get('transactions')
  async getTransactions(@CurrentUser() user: AccessTokenPayload) {
    return this.wallets.listTransactions(user.sub, 50);
  }
}
