import { Controller, Get, Post } from '@nestjs/common';
import { GamesDayService } from './games-day.service';

@Controller('games-day')
export class GamesDayController {
  constructor(private readonly gamesDayService: GamesDayService) {}

  @Get('today')
  async getToday() {
    const data = await this.gamesDayService.getTodaySummary();
    return { success: true, data };
  }

  @Post('sync')
  async sync() {
    const result = await this.gamesDayService.syncGamesDay();
    return { success: true, data: result };
  }
}
