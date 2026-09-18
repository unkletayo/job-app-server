import { Injectable } from '@nestjs/common';
import { JobPreferences } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateJobPreferencesDto } from './dto/update-job-preferences.dto';

@Injectable()
export class JobPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  // Unlike CandidateProfileService.findOne, this never 404s — discovery and
  // matching (later tickets) need something to read even before the user has
  // customized anything, so a first GET silently creates the all-defaults row.
  findOne(userId: string): Promise<JobPreferences> {
    return this.prisma.jobPreferences.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  update(userId: string, dto: UpdateJobPreferencesDto): Promise<JobPreferences> {
    return this.prisma.jobPreferences.upsert({
      where: { userId },
      create: { ...dto, userId },
      update: dto,
    });
  }
}
