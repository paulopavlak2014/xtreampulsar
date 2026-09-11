import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewayModule } from '../gateway/gateway.module';
import { MetadataModule } from '../metadata/metadata.module';
import { DownloadService } from './download.service';
import { DownloadController } from './download.controller';
import { MediaController } from './media.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, GatewayModule, MetadataModule, AuthModule],
  controllers: [DownloadController, MediaController],
  providers: [DownloadService],
  exports: [DownloadService],
})
export class DownloadModule {}
