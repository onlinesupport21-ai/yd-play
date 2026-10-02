import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { WalletModule } from '../wallet/wallet.module';
import { EngagementModule } from '../engagement/engagement.module';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';

@Module({
  imports: [JwtModule.register({}), WalletModule, EngagementModule],
  controllers: [GamesController],
  providers: [GamesService, JwtAuthGuard],
  exports: [GamesService]
})
export class GamesModule {}
