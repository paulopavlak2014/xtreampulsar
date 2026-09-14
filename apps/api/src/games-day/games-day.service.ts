import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import * as https from 'https';

const BOUQUET_ID = 'cmu15m2xh3k5rgmxygfy7qhel';
const CATEGORY_NAME = 'JOGOS DO DIA';
const KICKOFF_API_KEY = 'ft_apliativ_cd6e57aafba56e4cf8708269313c04a87c225dbb';

const LEAGUE_CHANNEL_MAP: Record<number, string[]> = {
  71:  ['SPORTV', 'PREMIERE', 'GOAT TV', 'CAZÉ TV', 'AMAZON PRIME'],
  72:  ['ESPN', 'DISNEY+', 'SPORTYNET', 'REDE TV!', 'GOAT TV'],
  73:  ['SPORTV', 'PREMIERE', 'GOAT TV', 'AMAZON PRIME'],
  9:   ['SPORTV', 'PREMIERE'],
  13:  ['SPORTV', 'PREMIERE', 'BAND SPORTS'],
  11:  ['SPORTV', 'PREMIERE', 'ESPN', 'GOAT TV', 'AMAZON PRIME'],
  12:  ['ESPN', 'DISNEY+', 'GOAT TV'],
  2:   ['TNT', 'HBO MAX', 'SBT'],
  3:   ['TNT', 'HBO MAX'],
  848: ['TNT', 'HBO MAX'],
  39:  ['ESPN', 'DISNEY+'],
  140: ['ESPN', 'DISNEY+', 'CAZÉ TV'],
  135: ['ESPN', 'DISNEY+', 'SPORTYNET', 'DAZN'],
  78:  ['SPORTYNET', 'BAND SPORTS'],
  61:  ['ESPN', 'DISNEY+', 'DAZN'],
};

interface KickoffFixture {
  id: number;
  date: string;
  leagueId: number;
  homeTeam: { name: string; logo: string };
  awayTeam: { name: string; logo: string };
}

@Injectable()
export class GamesDayService {
  private readonly logger = new Logger(GamesDayService.name);

  constructor(private readonly prisma: PrismaService) {}

  private fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { headers }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('JSON parse error'));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('timeout'));
      });
    });
  }

  private formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
    const h = brt.getUTCHours().toString().padStart(2, '0');
    const m = brt.getUTCMinutes().toString().padStart(2, '0');
    return `${h}h${m}`;
  }

  private getTodayBrasilia(): string {
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    return brt.toISOString().split('T')[0];
  }

  async syncGamesDay(): Promise<{ created: number; skipped: number; games: number }> {
    this.logger.log('Iniciando sincronização de Jogos do Dia...');

    const today = this.getTodayBrasilia();

    const data = await this.fetchJson(
      `https://api.kickoffapi.com/api/v1/fixtures?date=${today}`,
      { 'x-api-key': KICKOFF_API_KEY },
    );

    const allFixtures: KickoffFixture[] = (data.response ?? []).filter(
      (f: KickoffFixture) => LEAGUE_CHANNEL_MAP[f.leagueId],
    );

    this.logger.log(`Jogos das ligas mapeadas hoje (${today}): ${allFixtures.length}`);
    if (allFixtures.length === 0) {
      return { created: 0, skipped: 0, games: 0 };
    }

    let category = await this.prisma.category.findFirst({
      where: { name: CATEGORY_NAME },
    });

    if (!category) {
      category = await this.prisma.category.create({
        data: {
          name: CATEGORY_NAME,
          type: 'LIVE',
          categoryBouquets: { create: { bouquetId: BOUQUET_ID } },
        },
      });
      this.logger.log(`Categoria "${CATEGORY_NAME}" criada.`);
    }

    const deleted = await this.prisma.stream.deleteMany({
      where: { categoryId: category.id },
    });
    this.logger.log(`${deleted.count} canais antigos removidos.`);

    const allStreams = await this.prisma.stream.findMany({
      where: { isActive: true },
      select: { id: true, name: true, primaryUrl: true },
    });

    this.logger.log(`Total de streams ativos no painel: ${allStreams.length}`);

    let created = 0;
    let skipped = 0;

    for (const fixture of allFixtures) {
      const channelKeywords = LEAGUE_CHANNEL_MAP[fixture.leagueId];
      const home = fixture.homeTeam.name;
      const away = fixture.awayTeam.name;
      const time = this.formatTime(fixture.date);
      const logo =
        fixture.homeTeam.logo ||
        'https://images.icon-icons.com/861/PNG/512/Soccer_icon-icons.com_67819.png';

      for (const keyword of channelKeywords) {
        const matchingStreams = allStreams.filter((s) =>
          s.name.toUpperCase().includes(keyword.toUpperCase()),
        );

        if (matchingStreams.length === 0) {
          this.logger.debug(`Nenhum canal encontrado para keyword "${keyword}"`);
          skipped++;
          continue;
        }

        for (const stream of matchingStreams) {
          const quality =
            stream.name.match(/\b(4K|FHD|HD|SD)\b/i)?.[1]?.toUpperCase() ?? 'HD';

          const streamName = `${home} x ${away} - ${time} - ${quality} (${keyword})`;

          try {
            await this.prisma.stream.create({
              data: {
                name: streamName,
                primaryUrl: stream.primaryUrl,
                categoryId: category.id,
                streamMode: 'PROXY',
                tvgLogo: logo,
                isActive: true,
                sortOrder: 0,
              },
            });
            created++;
          } catch (err) {
            this.logger.warn(`Erro ao criar stream "${streamName}": ${err.message}`);
            skipped++;
          }

          await new Promise((r) => setTimeout(r, 30));
        }
      }
    }

    this.logger.log(
      `Jogos do Dia finalizado: ${created} canais criados, ${skipped} ignorados, ${allFixtures.length} jogos.`,
    );

    return { created, skipped, games: allFixtures.length };
  }

  @Cron('0 9 * * *')
  async scheduledSync() {
    try {
      await this.syncGamesDay();
    } catch (err) {
      this.logger.error('Erro no cron de Jogos do Dia:', err);
    }
  }
}
