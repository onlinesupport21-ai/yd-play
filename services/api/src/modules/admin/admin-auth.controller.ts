import { Body, Controller, Headers, Ip, Post, UseGuards } from '@nestjs/common';
import { CurrentAdmin } from '../../common/admin/admin-current.decorator';
import { AdminAccessGuard } from '../../common/admin/admin-access.guard';
import { AdminPrincipal } from '../../common/admin/admin.types';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  login(
    @Body() dto: AdminLoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string
  ) {
    return this.auth.login(dto, ip, userAgent);
  }

  @Post('logout')
  @UseGuards(AdminAccessGuard)
  logout(@CurrentAdmin() admin: AdminPrincipal) {
    return this.auth.logout(admin.sessionId);
  }
}
