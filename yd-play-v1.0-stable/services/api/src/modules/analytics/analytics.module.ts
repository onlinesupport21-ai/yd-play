import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
@Module({imports:[JwtModule.register({})],controllers:[AnalyticsController],providers:[AnalyticsService,JwtAuthGuard],exports:[AnalyticsService]})
export class AnalyticsModule{}
