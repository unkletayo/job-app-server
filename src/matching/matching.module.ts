import { Module } from '@nestjs/common';
import { JobPreferencesModule } from '../job-preferences/job-preferences.module';
import { MatchingService } from './matching.service';

@Module({
  imports: [JobPreferencesModule],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
