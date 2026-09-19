import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WatchedCompany } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWatchedCompanyDto } from './dto/create-watched-company.dto';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class WatchedCompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string): Promise<WatchedCompany[]> {
    return this.prisma.watchedCompany.findMany({ where: { userId } });
  }

  async create(userId: string, dto: CreateWatchedCompanyDto): Promise<WatchedCompany> {
    try {
      return await this.prisma.watchedCompany.create({ data: { ...dto, userId } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictException(
          `Already watching "${dto.boardToken}" on ${dto.source}.`,
        );
      }
      throw error;
    }
  }

  // deleteMany (not delete) so the ownership check is part of the mutating
  // query itself, atomically — same pattern as EntryCrudService.remove.
  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.watchedCompany.deleteMany({ where: { id, userId } });
    if (count === 0) {
      throw new NotFoundException('Watched company not found.');
    }
  }
}
