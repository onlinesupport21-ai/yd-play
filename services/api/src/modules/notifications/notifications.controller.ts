import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AccessTokenPayload } from '../../common/auth/auth.types';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';
import { UnregisterPushDeviceDto } from './dto/unregister-push-device.dto';
import { NotificationsService } from './notifications.service';
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController{
 constructor(private readonly notifications:NotificationsService){}
 @Get() list(@CurrentUser() u:AccessTokenPayload,@Query('limit') limit='50'){return this.notifications.list(u.sub,Number(limit));}
 @Post(':id/read') read(@CurrentUser() u:AccessTokenPayload,@Param('id') id:string){return this.notifications.markRead(u.sub,id);}
 @Post('devices') register(@CurrentUser() u:AccessTokenPayload,@Body() dto:RegisterPushDeviceDto){return this.notifications.registerDevice(u.sub,dto);}
 @Post('devices/unregister') unregister(@CurrentUser() u:AccessTokenPayload,@Body() dto:UnregisterPushDeviceDto){return this.notifications.unregisterDevice(u.sub,dto.token);}
}
