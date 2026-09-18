import { Module } from '@nestjs/common';
import { JobPreferencesController } from './job-preferences.controller';
import { JobPreferencesService } from './job-preferences.service';

@Module({
  controllers: [JobPreferencesController],
  providers: [JobPreferencesService],
})
export class JobPreferencesModule {}
