import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AccessTokenPayload } from '../../common/auth/auth.types';
import { EngagementService } from './engagement.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class EngagementController {
  constructor(private readonly engagement:EngagementService) {}
  @Get('missions') missions(@CurrentUser() u:AccessTokenPayload){ return this.engagement.missions(u.sub); }
  @Post('missions/:missionId/claim') claimMission(@CurrentUser() u:AccessTokenPayload,@Param('missionId') id:string){ return this.engagement.claimMission(u.sub,id); }
  @Get('achievements') achievements(@CurrentUser() u:AccessTokenPayload){ return this.engagement.achievements(u.sub); }
  @Post('achievements/:achievementId/claim') claimAchievement(@CurrentUser() u:AccessTokenPayload,@Param('achievementId') id:string){ return this.engagement.claimAchievement(u.sub,id); }
  @Get('leaderboards/:code') leaderboard(@CurrentUser() u:AccessTokenPayload,@Param('code') code:string,@Query('limit') limit='50'){ return this.engagement.leaderboard(code,u.sub,Number(limit)); }
}
