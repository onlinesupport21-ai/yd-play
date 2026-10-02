import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [RoomsController],
  providers: [RoomsService]
})
export class RoomsModule {}
