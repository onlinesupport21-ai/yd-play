import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessTokenPayload } from '../../common/auth/auth.types';
import { RoomsService } from './rooms.service';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get('me/active')
  active(@CurrentUser() user: AccessTokenPayload) {
    return this.rooms.activeForUser(user.sub);
  }

  @Get(':roomId')
  get(
    @CurrentUser() user: AccessTokenPayload,
    @Param('roomId', ParseUUIDPipe) roomId: string
  ) {
    return this.rooms.getRoom(user.sub, roomId);
  }
}
