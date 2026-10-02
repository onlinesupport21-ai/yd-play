import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Post,
  UseGuards
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessTokenPayload } from '../../common/auth/auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(
    @Body() dto: RegisterDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string
  ) {
    return this.auth.register(dto, ip, userAgent);
  }

  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string
  ) {
    return this.auth.login(dto, ip, userAgent);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AccessTokenPayload) {
    await this.auth.logout(user.sid);
    return { ok: true };
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  session(@CurrentUser() user: AccessTokenPayload) {
    return { userId: user.sub, sessionId: user.sid };
  }
}
