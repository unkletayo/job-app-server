import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JobClustersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.jobCluster.findMany({
      where: { userId },
      include: { jobPosting: true, sourcePostings: true },
    });
  }

  async findOne(userId: string, id: string) {
    const jobCluster = await this.prisma.jobCluster.findFirst({
      where: { id, userId },
      include: { jobPosting: true, sourcePostings: true },
    });
    if (!jobCluster) {
      throw new NotFoundException('Job cluster not found.');
    }
    return jobCluster;
  }
}
