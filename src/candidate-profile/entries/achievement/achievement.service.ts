import { Injectable } from '@nestjs/common';
import { Achievement } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EntryCrudService } from '../entry-crud.service';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { UpdateAchievementDto } from './dto/update-achievement.dto';

@Injectable()
export class AchievementService extends EntryCrudService<Achievement> {
  constructor(prisma: PrismaService) {
    super(prisma.achievement);
  }

  createForUser(userId: string, dto: CreateAchievementDto): Promise<Achievement> {
    return this.create({ ...dto, userId });
  }

  updateForUser(userId: string, id: string, dto: UpdateAchievementDto): Promise<Achievement> {
    return this.performUpdate(userId, id, dto);
  }
}
