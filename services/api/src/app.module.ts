import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './common/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { HealthController } from './modules/health/health.controller';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { GamesModule } from './modules/games/games.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { AdminModule } from './modules/admin/admin.module';
import { ReportsModule } from './modules/reports/reports.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    WalletModule,
    ReferralsModule,
    GamesModule,
    RoomsModule,
    AdminModule,
    ReportsModule,
    EngagementModule,
    AnalyticsModule,
    NotificationsModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
