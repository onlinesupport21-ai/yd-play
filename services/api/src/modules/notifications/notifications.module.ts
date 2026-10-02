import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
@Module({imports:[ConfigModule,JwtModule.register({})],controllers:[NotificationsController],providers:[NotificationsService,JwtAuthGuard],exports:[NotificationsService]})
export class NotificationsModule{}
