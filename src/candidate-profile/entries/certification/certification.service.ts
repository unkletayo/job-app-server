import { Injectable } from '@nestjs/common';
import { Certification } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EntryCrudService } from '../entry-crud.service';
import { CreateCertificationDto } from './dto/create-certification.dto';
import { UpdateCertificationDto } from './dto/update-certification.dto';

@Injectable()
export class CertificationService extends EntryCrudService<Certification> {
  constructor(prisma: PrismaService) {
    super(prisma.certification);
  }

  createForUser(userId: string, dto: CreateCertificationDto): Promise<Certification> {
    return this.create({ ...dto, userId });
  }

  updateForUser(userId: string, id: string, dto: UpdateCertificationDto): Promise<Certification> {
    return this.performUpdate(userId, id, dto);
  }
}
