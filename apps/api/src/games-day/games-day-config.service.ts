import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GamesDayConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig() {
    let config = await this.prisma.gamesDayConfig.findFirst({
      include: { leagues: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!config) {
      config = await this.prisma.gamesDayConfig.create({
        data: {},
        include: { leagues: { orderBy: { sortOrder: 'asc' } } },
      });
    }
    return config;
  }

  async updateConfig(data: {
    categoryName?: string;
    bouquetId?: string | null;
    allowedQualities?: string[];
    syncHour?: number;
    isActive?: boolean;
  }) {
    const config = await this.getConfig();
    return this.prisma.gamesDayConfig.update({
      where: { id: config.id },
      data,
      include: { leagues: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async addLeague(data: { leagueId: number; leagueName: string; channels: string[] }) {
    const config = await this.getConfig();
    const maxSort = await this.prisma.gamesDayLeague.findFirst({
      where: { configId: config.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return this.prisma.gamesDayLeague.create({
      data: {
        configId: config.id,
        leagueId: data.leagueId,
        leagueName: data.leagueName,
        channels: data.channels,
        sortOrder: (maxSort?.sortOrder ?? 0) + 1,
      },
    });
  }

  async updateLeague(id: string, data: { leagueName?: string; channels?: string[]; isActive?: boolean; sortOrder?: number }) {
    return this.prisma.gamesDayLeague.update({ where: { id }, data });
  }

  async removeLeague(id: string) {
    return this.prisma.gamesDayLeague.delete({ where: { id } });
  }

  async getLeagueChannelMap(): Promise<Record<number, string[]>> {
    const config = await this.getConfig();
    const leagues = config.leagues.filter((l) => l.isActive);
    const map: Record<number, string[]> = {};
    for (const l of leagues) {
      map[l.leagueId] = l.channels;
    }
    return map;
  }

  async getAllowedQualities(): Promise<string[]> {
    const config = await this.getConfig();
    return config.allowedQualities;
  }
}
