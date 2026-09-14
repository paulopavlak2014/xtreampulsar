import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { GamesDayService } from './games-day.service';

@Module({
  imports: [ScheduleModule, PrismaModule],
  providers: [GamesDayService],
  exports: [GamesDayService],
})
export class GamesDayModule {}
