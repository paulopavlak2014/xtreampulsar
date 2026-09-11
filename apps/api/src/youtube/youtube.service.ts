import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const execFileP = promisify(execFile);

export interface YtResolveResult {
  title: string;
  url: string;
  isLive: boolean;
  thumbnail: string;
}

@Injectable()
export class YouTubeService {
  private readonly logger = new Logger(YouTubeService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async cookiesFile(): Promise<string | null> {
    const s = await this.prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { youtubeCookies: true },
    });
    const cookies = (s?.youtubeCookies ?? '').trim();
    if (!cookies) return null;
    const file = path.join(os.tmpdir(), `yt-cookies-${crypto.randomBytes(6).toString('hex')}.txt`);
    await fs.writeFile(file, cookies, { mode: 0o600 });
    return file;
  }

  private async ytVersion(): Promise<string | null> {
    try {
      const { stdout } = await execFileP('yt-dlp', ['--version'], { timeout: 10_000 });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /** yt-dlp ile bir YouTube (veya desteklenen) URL'i dogrudan oynatilabilir akisa cozer. */
  async resolve(url: string): Promise<YtResolveResult> {
    if (!/^https?:\/\//i.test(url)) throw new BadRequestException('Geçersiz URL');

    const version = await this.ytVersion();
    if (!version) {
      throw new BadRequestException(
        'yt-dlp sunucuda bulunamadı. API imajını yt-dlp ile yeniden derleyin (docker compose up -d --build api).',
      );
    }

    const cookies = await this.cookiesFile();

    // Adım 1: Video bilgilerini al (title, is_live, thumbnail)
    const infoArgs = [
      '--no-warnings', '--no-playlist',
      '--print', '%(title)s',
      '--print', '%(is_live)s',
      '--print', '%(thumbnail)s',
      '--skip-download',
    ];
    if (cookies) infoArgs.push('--cookies', cookies);
    infoArgs.push(url);

    let title = 'YouTube';
    let isLive = false;
    let thumbnail = '';

    try {
      const { stdout: infoOut } = await execFileP('yt-dlp', infoArgs, { timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
      const infoLines = infoOut.trim().split('\n').map((l) => l.trim()).filter(Boolean);
      title = infoLines[0] || 'YouTube';
      isLive = (infoLines[1] || '').toLowerCase() === 'true';
      thumbnail = /^https?:\/\//i.test(infoLines[2] || '') ? infoLines[2] : '';
    } catch (err) {
      const e = err as { stderr?: string; message?: string };
      const detail = (e.stderr || e.message || '').split('\n').filter(Boolean).slice(-1)[0] || 'bilinmeyen hata';
      this.logger.error(`yt-dlp info failed (v${version}): ${e.stderr || e.message}`);
      throw new BadRequestException(`YouTube çözümlenemedi: ${detail.slice(0, 240)}`);
    } finally {
      if (cookies) await fs.unlink(cookies).catch(() => {});
    }

    // Adım 2: Oynatılabilir URL'i al (-g = --get-url)
    const urlArgs = [
      '--no-warnings', '--no-playlist',
      '-g',
    ];
    if (isLive) {
      // Canlı yayınlar için en iyi formatı seç
      urlArgs.push('-f', 'best[protocol!=m3u8]');
    } else {
      urlArgs.push('-f', 'best');
    }
    const cookies2 = await this.cookiesFile();
    if (cookies2) urlArgs.push('--cookies', cookies2);
    urlArgs.push(url);

    try {
      const { stdout: urlOut } = await execFileP('yt-dlp', urlArgs, { timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
      const mediaUrl = urlOut.trim().split('\n')[0]?.trim() || '';
      if (!mediaUrl || !/^https?:\/\//i.test(mediaUrl)) {
        throw new Error('Akış URL\'i alınamadı (format bulunamadı).');
      }
      return { title, url: mediaUrl, isLive, thumbnail };
    } catch (err) {
      const e = err as { stderr?: string; message?: string };
      const detail = (e.stderr || e.message || '').split('\n').filter(Boolean).slice(-1)[0] || 'bilinmeyen hata';
      this.logger.error(`yt-dlp url failed (v${version}): ${e.stderr || e.message}`);
      throw new BadRequestException(`YouTube çözümlenemedi: ${detail.slice(0, 240)}`);
    } finally {
      if (cookies2) await fs.unlink(cookies2).catch(() => {});
    }
  }

  async importStream(dto: { url: string; categoryId: string; name?: string; streamMode?: string }) {
    if (!dto.categoryId) throw new BadRequestException('Kategori seçilmedi');
    const resolved = await this.resolve(dto.url);
    const stream = await this.prisma.stream.create({
      data: {
        name: dto.name?.trim() || resolved.title,
        primaryUrl: resolved.url,
        categoryId: dto.categoryId,
        streamMode: dto.streamMode ?? 'PROXY',
        tvgLogo: resolved.thumbnail || undefined,
      },
      include: { category: true },
    });
    return { stream, resolved };
  }
}
