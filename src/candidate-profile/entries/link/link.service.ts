import { Injectable } from '@nestjs/common';
import { Link } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EntryCrudService } from '../entry-crud.service';
import { CreateLinkDto } from './dto/create-link.dto';
import { UpdateLinkDto } from './dto/update-link.dto';

@Injectable()
export class LinkService extends EntryCrudService<Link> {
  constructor(prisma: PrismaService) {
    super(prisma.link);
  }

  createForUser(userId: string, dto: CreateLinkDto): Promise<Link> {
    return this.create({ ...dto, userId });
  }

  updateForUser(userId: string, id: string, dto: UpdateLinkDto): Promise<Link> {
    return this.performUpdate(userId, id, dto);
  }
}
