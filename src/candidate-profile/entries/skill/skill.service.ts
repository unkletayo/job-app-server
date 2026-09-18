import { Injectable } from '@nestjs/common';
import { Skill } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EntryCrudService } from '../entry-crud.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';

@Injectable()
export class SkillService extends EntryCrudService<Skill> {
  constructor(prisma: PrismaService) {
    super(prisma.skill);
  }

  createForUser(userId: string, dto: CreateSkillDto): Promise<Skill> {
    return this.create({ ...dto, userId });
  }

  updateForUser(userId: string, id: string, dto: UpdateSkillDto): Promise<Skill> {
    return this.performUpdate(userId, id, dto);
  }
}
