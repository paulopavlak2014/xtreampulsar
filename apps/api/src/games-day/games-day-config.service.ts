import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_LEAGUES = [
  { leagueId: 71,  leagueName: 'Brasileirão Série A',    channels: ['SPORTV', 'PREMIERE', 'GOAT TV', 'CAZÉ TV', 'AMAZON PRIME'] },
  { leagueId: 72,  leagueName: 'Brasileirão Série B',    channels: ['ESPN', 'DISNEY+', 'SPORTYNET', 'REDE TV!', 'GOAT TV'] },
  { leagueId: 73,  leagueName: 'Copa do Brasil',         channels: ['SPORTV', 'PREMIERE', 'GOAT TV', 'AMAZON PRIME'] },
  { leagueId: 13,  leagueName: 'Brasileirão Série C',    channels: ['SPORTV', 'PREMIERE', 'BAND SPORTS'] },
  { leagueId: 11,  leagueName: 'Copa Libertadores',      channels: ['SPORTV', 'PREMIERE', 'ESPN', 'GOAT TV', 'AMAZON PRIME'] },
  { leagueId: 12,  leagueName: 'Copa Sul-Americana',     channels: ['ESPN', 'DISNEY+', 'GOAT TV'] },
  { leagueId: 2,   leagueName: 'Champions League',       channels: ['TNT', 'HBO MAX', 'SBT'] },
  { leagueId: 3,   leagueName: 'Europa League',          channels: ['TNT', 'HBO MAX'] },
  { leagueId: 848, leagueName: 'Conference League',      channels: ['TNT', 'HBO MAX'] },
  { leagueId: 39,  leagueName: 'Premier League',         channels: ['ESPN', 'DISNEY+'] },
  { leagueId: 140, leagueName: 'La Liga',                channels: ['ESPN', 'DISNEY+', 'CAZÉ TV'] },
  { leagueId: 135, leagueName: 'Serie A Italiana',       channels: ['ESPN', 'DISNEY+', 'SPORTYNET', 'DAZN'] },
  { leagueId: 78,  leagueName: 'Bundesliga',             channels: ['SPORTYNET', 'BAND SPORTS'] },
  { leagueId: 61,  leagueName: 'Ligue 1',                channels: ['ESPN', 'DISNEY+', 'DAZN'] },
];

@Injectable()
export class GamesDayConfigService {
  private readonly logger = new Logger(GamesDayConfigService.name);

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

    if (config.leagues.length === 0) {
      this.logger.log('Nenhuma liga configurada — criando ligas padrão...');
      for (let i = 0; i < DEFAULT_LEAGUES.length; i++) {
        await this.prisma.gamesDayLeague.create({
          data: {
            configId: config.id,
            leagueId: DEFAULT_LEAGUES[i].leagueId,
            leagueName: DEFAULT_LEAGUES[i].leagueName,
            channels: DEFAULT_LEAGUES[i].channels,
            sortOrder: i + 1,
          },
        });
      }
      config = await this.prisma.gamesDayConfig.findFirst({
        where: { id: config.id },
        include: { leagues: { orderBy: { sortOrder: 'asc' } } },
      });
      this.logger.log(`${DEFAULT_LEAGUES.length} ligas padrão criadas.`);
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
