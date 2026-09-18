import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CandidateProfileModule } from './candidate-profile/candidate-profile.module';
import { JobPreferencesModule } from './job-preferences/job-preferences.module';
import { JobPostingsModule } from './job-postings/job-postings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CandidateProfileModule,
    JobPreferencesModule,
    JobPostingsModule,
  ],
})
export class AppModule {}
