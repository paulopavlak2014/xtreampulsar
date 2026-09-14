import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GamesDayService } from './games-day.service';
import { GamesDayController } from './games-day.controller';

@Module({
  imports: [ScheduleModule, PrismaModule, AuthModule],
  controllers: [GamesDayController],
  providers: [GamesDayService],
  exports: [GamesDayService],
})
export class GamesDayModule {}
