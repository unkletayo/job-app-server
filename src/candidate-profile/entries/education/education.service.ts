import { Injectable } from '@nestjs/common';
import { Education } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EntryCrudService } from '../entry-crud.service';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';

@Injectable()
export class EducationService extends EntryCrudService<Education> {
  constructor(prisma: PrismaService) {
    super(prisma.education);
  }

  createForUser(userId: string, dto: CreateEducationDto): Promise<Education> {
    return this.create({ ...dto, userId });
  }

  updateForUser(userId: string, id: string, dto: UpdateEducationDto): Promise<Education> {
    return this.performUpdate(userId, id, dto);
  }
}
