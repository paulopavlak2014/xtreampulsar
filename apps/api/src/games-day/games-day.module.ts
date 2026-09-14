import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { GamesDayService } from './games-day.service';
import { GamesDayController } from './games-day.controller';
import { GamesDayConfigService } from './games-day-config.service';
import { GamesDayConfigController } from './games-day-config.controller';

@Module({
  imports: [ScheduleModule, PrismaModule],
  controllers: [GamesDayController, GamesDayConfigController],
  providers: [GamesDayService, GamesDayConfigService],
  exports: [GamesDayService, GamesDayConfigService],
})
export class GamesDayModule {}
