import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AccessTokenPayload } from '../../common/auth/auth.types';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('me')
  mine(@CurrentUser() user: AccessTokenPayload, @Query('limit') limit='50') { return this.reports.listMine(user.sub, Number(limit)); }

  @Post()
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateReportDto) {
    return this.reports.create(user.sub, dto);
  }
}
