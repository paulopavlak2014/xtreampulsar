import { Controller, Get, Put, Post, Delete, Body, Param } from '@nestjs/common';
import { GamesDayConfigService } from './games-day-config.service';

@Controller('games-day-config')
export class GamesDayConfigController {
  constructor(private readonly configService: GamesDayConfigService) {}

  @Get()
  getConfig() {
    return this.configService.getConfig();
  }

  @Put()
  updateConfig(@Body() body: { categoryName?: string; bouquetId?: string | null; allowedQualities?: string[]; syncHour?: number; isActive?: boolean }) {
    return this.configService.updateConfig(body);
  }

  @Post('leagues')
  addLeague(@Body() body: { leagueId: number; leagueName: string; channels: string[] }) {
    return this.configService.addLeague(body);
  }

  @Put('leagues/:id')
  updateLeague(@Param('id') id: string, @Body() body: { leagueName?: string; channels?: string[]; isActive?: boolean; sortOrder?: number }) {
    return this.configService.updateLeague(id, body);
  }

  @Delete('leagues/:id')
  removeLeague(@Param('id') id: string) {
    return this.configService.removeLeague(id);
  }
}
