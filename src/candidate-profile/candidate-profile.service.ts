import { Injectable, NotFoundException } from '@nestjs/common';
import { CandidateProfile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCandidateProfileDto } from './dto/upsert-candidate-profile.dto';

@Injectable()
export class CandidateProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(userId: string): Promise<CandidateProfile> {
    const profile = await this.prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Candidate profile has not been created yet.');
    }
    return profile;
  }

  upsert(userId: string, dto: UpsertCandidateProfileDto): Promise<CandidateProfile> {
    return this.prisma.candidateProfile.upsert({
      where: { userId },
      create: { ...dto, userId },
      update: dto,
    });
  }
}
