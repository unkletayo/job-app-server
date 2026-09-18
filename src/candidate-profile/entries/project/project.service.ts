import { Injectable } from '@nestjs/common';
import { Project } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EntryCrudService } from '../entry-crud.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectService extends EntryCrudService<Project> {
  constructor(prisma: PrismaService) {
    super(prisma.project);
  }

  createForUser(userId: string, dto: CreateProjectDto): Promise<Project> {
    return this.create({ ...dto, userId });
  }

  updateForUser(userId: string, id: string, dto: UpdateProjectDto): Promise<Project> {
    return this.performUpdate(userId, id, dto);
  }
}
