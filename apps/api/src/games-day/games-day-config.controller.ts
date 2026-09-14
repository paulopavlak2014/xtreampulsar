import { Controller, Get, Put, Post, Delete, Body, Param } from '@nestjs/common';
import { GamesDayConfigService } from './games-day-config.service';

@Controller('games-day-config')
export class GamesDayConfigController {
  constructor(private readonly configService: GamesDayConfigService) {}

  @Get()
  async getConfig() {
    const data = await this.configService.getConfig();
    return { success: true, data };
  }

  @Get('sports-channels')
  async getSportsChannels() {
    const data = await this.configService.getSportsChannels();
    return { success: true, data };
  }

  @Put()
  async updateConfig(@Body() body: { categoryName?: string; bouquetId?: string | null; allowedQualities?: string[]; maxChannelsPerMatch?: number; syncHour?: number; isActive?: boolean }) {
    const data = await this.configService.updateConfig(body);
    return { success: true, data };
  }

  @Post('leagues')
  async addLeague(@Body() body: { leagueId: number; leagueName: string; channels: string[] }) {
    const data = await this.configService.addLeague(body);
    return { success: true, data };
  }

  @Put('leagues/:id')
  async updateLeague(@Param('id') id: string, @Body() body: { leagueName?: string; channels?: string[]; isActive?: boolean; sortOrder?: number }) {
    const data = await this.configService.updateLeague(id, body);
    return { success: true, data };
  }

  @Delete('leagues/:id')
  async removeLeague(@Param('id') id: string) {
    await this.configService.removeLeague(id);
    return { success: true };
  }
}
