import { Injectable, NotFoundException } from '@nestjs/common';
import { JobPosting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JobPostingsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string): Promise<JobPosting[]> {
    return this.prisma.jobPosting.findMany({ where: { userId } });
  }

  async findOne(userId: string, id: string) {
    const jobPosting = await this.prisma.jobPosting.findFirst({
      where: { id, userId },
      include: { sourcePosting: true },
    });
    if (!jobPosting) {
      throw new NotFoundException('Job posting not found.');
    }
    return jobPosting;
  }
}
