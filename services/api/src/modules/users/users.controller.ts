import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessTokenPayload } from '../../common/auth/auth.types';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AccessTokenPayload) {
    return this.users.getMe(user.sub);
  }

  @Patch('me')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: UpdateProfileDto
  ) {
    return this.users.updateMe(user.sub, dto);
  }
}
