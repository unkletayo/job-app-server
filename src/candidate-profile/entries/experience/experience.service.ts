import { Injectable } from '@nestjs/common';
import { Experience } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EntryCrudService } from '../entry-crud.service';
import { CreateExperienceDto } from './dto/create-experience.dto';
import { UpdateExperienceDto } from './dto/update-experience.dto';

@Injectable()
export class ExperienceService extends EntryCrudService<Experience> {
  constructor(prisma: PrismaService) {
    super(prisma.experience);
  }

  createForUser(userId: string, dto: CreateExperienceDto): Promise<Experience> {
    return this.create({ ...dto, userId });
  }

  updateForUser(userId: string, id: string, dto: UpdateExperienceDto): Promise<Experience> {
    return this.performUpdate(userId, id, dto);
  }
}
