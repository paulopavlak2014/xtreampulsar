import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GamesDayService } from './games-day.service';

@Controller('games-day')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GamesDayController {
  constructor(private readonly gamesDayService: GamesDayService) {}

  @Post('sync')
  @Roles('ADMIN')
  async sync() {
    const result = await this.gamesDayService.syncGamesDay();
    return { success: true, data: result };
  }
}
