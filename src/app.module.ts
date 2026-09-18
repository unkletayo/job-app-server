import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CandidateProfileModule } from './candidate-profile/candidate-profile.module';
import { JobPreferencesModule } from './job-preferences/job-preferences.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CandidateProfileModule,
    JobPreferencesModule,
  ],
})
export class AppModule {}
