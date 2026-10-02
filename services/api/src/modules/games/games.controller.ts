import {
  Body,
  Controller,
  Get,
  BadRequestException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AccessTokenPayload } from '../../common/auth/auth.types';
import { CompleteGameDto } from './dto/complete-game.dto';
import { GameInputDto } from './dto/game-input.dto';
import { GamesService } from './games.service';

@Controller('games')
@UseGuards(JwtAuthGuard)
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get()
  list() {
    return this.games.listGames();
  }

  @Post('pulse-grid/sessions')
  start(@CurrentUser() user: AccessTokenPayload) {
    return this.games.startPulseGrid(user.sub);
  }


  @Get('sessions/:sessionId/cues')
  cues(
    @CurrentUser() user: AccessTokenPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Query('after') after?: string
  ) {
    const afterIndex = after === undefined ? -1 : Number(after);
    if (!Number.isInteger(afterIndex) || afterIndex < -1) {
      throw new BadRequestException('after must be an integer >= -1');
    }
    return this.games.getCues(user.sub, sessionId, afterIndex);
  }

  @Get('sessions/:sessionId')
  getSession(
    @CurrentUser() user: AccessTokenPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string
  ) {
    return this.games.getSession(user.sub, sessionId);
  }

  @Post('sessions/:sessionId/input')
  input(
    @CurrentUser() user: AccessTokenPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: GameInputDto
  ) {
    return this.games.submitInput(user.sub, sessionId, dto);
  }

  @Post('sessions/:sessionId/complete')
  complete(
    @CurrentUser() user: AccessTokenPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: CompleteGameDto
  ) {
    return this.games.completeSession(user.sub, sessionId, dto.claimedScore);
  }
}
