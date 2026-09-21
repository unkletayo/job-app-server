import { Module } from '@nestjs/common';
import { MatchingModule } from '../matching/matching.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [MatchingModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
