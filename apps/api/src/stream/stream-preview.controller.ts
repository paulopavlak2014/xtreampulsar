import * as http from 'http';
import * as https from 'https';
import * as dns from 'dns';
import { Controller, Get, Inject, Param, Query, Req, Res, HttpStatus } from '@nestjs/common';
import type { IncomingMessage } from 'http';
import type { Request, Response } from 'express';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

/** Redis'te `preview:<token>` altinda tutulan onizleme hedefi. */
interface PreviewTarget {
  primaryUrl: string;
  streamId?: string;
  streamUserAgent?: string | null;
  httpHeaders?: string | null;
  httpCookie?: string | null;
}

/** Upstream yonlendirmelerinde izin verilen maksimum adim. */
const MAX_REDIRECTS = 3;

/** SSRF koruması — özel ve dahili adresleri engelle. */
const PRIVATE_IP_PATTERNS = /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|0\.|localhost|::1|\[::1\]|metadata\.google\.internal)/i;

async function isPrivateHost(hostname: string): Promise<boolean> {
  if (PRIVATE_IP_PATTERNS.test(hostname)) return true;
  try {
    const addresses = await dns.promises.resolve4(hostname);
    return addresses.some((addr) => PRIVATE_IP_PATTERNS.test(addr));
  } catch {
    return false;
  }
}

@Controller('streams/preview')
export class StreamPreviewController {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private async resolveToken(token: string): Promise<PreviewTarget | null> {
    const raw = await this.redis.get(`preview:${token}`);
    if (!raw) return null;
    const p = JSON.parse(raw) as PreviewTarget;
    return p?.primaryUrl ? p : null;
  }

  /** Akisin kendi upstream basliklari — kaynak UA/cookie ile filtreliyorsa
   *  onizleme de ayni basliklarla gitmeli, yoksa 403 alir. */
  private static upstreamHeaders(t: PreviewTarget, req: Request): Record<string, string> {
    const h: Record<string, string> = {
      'User-Agent': t.streamUserAgent?.trim() || req.headers['user-agent'] || 'XtreamPulsar/1.0',
      Accept: '*/*',
      Connection: 'keep-alive',
    };
    for (const line of (t.httpHeaders ?? '').split(/\r?\n/)) {
      const x = line.trim();
      const i = x.indexOf(':');
      if (i > 0) h[x.slice(0, i).trim()] = x.slice(i + 1).trim();
    }
    const c = t.httpCookie?.trim();
    if (c) h.Cookie = c;
    return h;
  }

  // Rewrites every non-comment, non-empty line in the playlist to go through the segment proxy.
  // Both relative paths and absolute URLs are handled.
  private rewriteM3u8(body: string, upstreamBase: string, token: string): string {
    return body
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;

        let absolute: string;
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          absolute = trimmed;
        } else {
          try {
            absolute = new URL(trimmed, upstreamBase).href;
          } catch {
            return line;
          }
        }

        return `/api/v1/streams/preview/${token}/segment?url=${encodeURIComponent(absolute)}`;
      })
      .join('\n');
  }

  private fetchAndRespond(
    upstreamUrl: string,
    token: string,
    req: Request,
    res: Response,
    target0: PreviewTarget,
    redirectCount = 0,
  ): void {
    let target: URL;
    try {
      target = new URL(upstreamUrl);
    } catch {
      res.status(HttpStatus.BAD_GATEWAY).send('Invalid upstream URL');
      return;
    }

    const client = target.protocol === 'https:' ? https : http;
    const port = target.port
      ? parseInt(target.port, 10)
      : target.protocol === 'https:'
        ? 443
        : 80;

    const upstreamReq = client.request(
      {
        hostname: target.hostname,
        port,
        path: target.pathname + target.search,
        method: 'GET',
        headers: StreamPreviewController.upstreamHeaders(target0, req),
      },
      (upstreamRes: IncomingMessage) => {
        // Xtream kaynaklari neredeyse her zaman 302 ile gercek akis adresine
        // yonlendirir. Eskiden 302 + Location oldugu gibi tarayiciya geciriliyordu;
        // tarayici da proxy'yi TAMAMEN atlayip ham MPEG-TS'i dogrudan cekmeye
        // baslıyordu (hls.js manifest bulamaz, <video> 0:00'da kalir, XHR
        // sinirsiz buyur — ayrica kaynak URL'i istemciye sizar). Yonlendirmeyi
        // artik sunucu tarafinda takip ediyoruz.
        const sc = upstreamRes.statusCode ?? 200;
        const loc = upstreamRes.headers['location'];
        if (sc >= 300 && sc < 400 && typeof loc === 'string' && loc) {
          upstreamRes.resume();
          if (redirectCount >= MAX_REDIRECTS) {
            if (!res.headersSent) {
              res.status(HttpStatus.BAD_GATEWAY).send('Too many upstream redirects');
            }
            return;
          }
          let next: string;
          try {
            next = new URL(loc, upstreamUrl).href;
          } catch {
            if (!res.headersSent) res.status(HttpStatus.BAD_GATEWAY).send('Invalid redirect');
            return;
          }
          this.fetchAndRespond(next, token, req, res, target0, redirectCount + 1);
          return;
        }

        const contentType = (upstreamRes.headers['content-type'] ?? '').toLowerCase();
        const isPlaylist =
          contentType.includes('mpegurl') ||
          upstreamUrl.includes('.m3u8') ||
          contentType.includes('x-mpegURL');

        if (isPlaylist) {
          const chunks: Buffer[] = [];
          upstreamRes.on('data', (chunk: Buffer) => chunks.push(chunk));
          upstreamRes.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf-8');
            const rewritten = this.rewriteM3u8(body, upstreamUrl, token);
            res.writeHead(upstreamRes.statusCode ?? 200, {
              'Content-Type': 'application/vnd.apple.mpegurl',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache, no-store',
              'X-Proxied-By': 'XtreamPulsar',
            });
            res.end(rewritten);
          });
        } else {
          const headers: Record<string, string | string[] | undefined> = {
            ...upstreamRes.headers,
            'Access-Control-Allow-Origin': '*',
            'X-Proxied-By': 'XtreamPulsar',
          };
          res.writeHead(upstreamRes.statusCode ?? 200, headers);
          upstreamRes.pipe(res);
        }
      },
    );

    upstreamReq.on('error', (err: Error) => {
      if (!res.headersSent) {
        res.status(HttpStatus.BAD_GATEWAY).json({ error: 'Bad Gateway', message: err.message });
      }
    });

    upstreamReq.end();
  }

  // Segment proxy — must be declared before :token to avoid route shadowing
  @Get(':token/segment')
  async proxySegment(
    @Param('token') token: string,
    @Query('url') encodedUrl: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const target = await this.resolveToken(token);
    if (!target) {
      res.status(HttpStatus.NOT_FOUND).send('Preview token expired or not found');
      return;
    }

    if (!encodedUrl) {
      res.status(HttpStatus.BAD_REQUEST).send('Missing url parameter');
      return;
    }

    let segmentUrl: string;
    try {
      segmentUrl = decodeURIComponent(encodedUrl);
      const parsed = new URL(segmentUrl); // throws if invalid
      if (await isPrivateHost(parsed.hostname)) {
        res.status(HttpStatus.FORBIDDEN).send('Access to private/internal URLs is forbidden');
        return;
      }
    } catch {
      res.status(HttpStatus.BAD_REQUEST).send('Invalid segment URL');
      return;
    }

    this.fetchAndRespond(segmentUrl, token, req, res, target);
  }

  // Main playlist proxy — rewrites m3u8 content, pipes binary data
  @Get(':token')
  async proxyPlaylist(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const target = await this.resolveToken(token);
    if (!target) {
      res.status(HttpStatus.NOT_FOUND).send('Preview token expired or not found');
      return;
    }

    this.fetchAndRespond(target.primaryUrl, token, req, res, target);
  }
}
