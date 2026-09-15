import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly categoryInclude = {
    categoryBouquets: { include: { bouquet: true } },
    _count: { select: { streams: true } },
  };

  async findAll(type?: 'LIVE' | 'VOD' | 'SERIES') {
    try {
      return await this.prisma.category.findMany({
        where: { ...(type ? { type } : {}) },
        include: this.categoryInclude,
        orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
      });
    } catch (err) {
      this.logger.error(`findAll: ${(err as Error).message}`);
      return [];
    }
  }

  async findById(id: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id },
      include: this.categoryInclude,
    });
    if (!cat) throw new NotFoundException(`Category ${id} not found`);
    return cat;
  }

  async create(dto: CreateCategoryDto) {
    const { bouquetIds, ...data } = dto;
    return this.prisma.category.create({
      data: {
        ...data,
        categoryBouquets: {
          create: bouquetIds.map((bouquetId) => ({ bouquetId })),
        },
      },
      include: this.categoryInclude,
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findById(id);
    const { bouquetIds, ...data } = dto;

    if (bouquetIds !== undefined) {
      await this.prisma.categoryBouquet.deleteMany({ where: { categoryId: id } });
      if (bouquetIds.length > 0) {
        await this.prisma.categoryBouquet.createMany({
          data: bouquetIds.map((bouquetId) => ({ categoryId: id, bouquetId })),
        });
      }
    }

    return this.prisma.category.update({
      where: { id },
      data,
      include: this.categoryInclude,
    });
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.category.delete({ where: { id } });
  }

  async reorder(categoryIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      categoryIds.map((id, index) =>
        this.prisma.category.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
  }

  findStreams(id: string, page = 1, limit = 20) {
    return this.prisma.stream.findMany({
      where: { categoryId: id, isActive: true },
      orderBy: { sortOrder: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}
