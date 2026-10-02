import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AccessTokenPayload } from '../../common/auth/auth.types';
import { AnalyticsService } from './analytics.service';
import { AnalyticsBatchDto } from './dto/analytics-event.dto';
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics:AnalyticsService){}
  @Post('events') events(@CurrentUser() u:AccessTokenPayload,@Body() dto:AnalyticsBatchDto){return this.analytics.ingest(u.sub,dto);}
}
