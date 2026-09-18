import { Module } from '@nestjs/common';
import { CandidateProfileController } from './candidate-profile.controller';
import { CandidateProfileService } from './candidate-profile.service';
import { ExperienceController } from './entries/experience/experience.controller';
import { ExperienceService } from './entries/experience/experience.service';
import { EducationController } from './entries/education/education.controller';
import { EducationService } from './entries/education/education.service';
import { CertificationController } from './entries/certification/certification.controller';
import { CertificationService } from './entries/certification/certification.service';
import { SkillController } from './entries/skill/skill.controller';
import { SkillService } from './entries/skill/skill.service';
import { ProjectController } from './entries/project/project.controller';
import { ProjectService } from './entries/project/project.service';
import { AchievementController } from './entries/achievement/achievement.controller';
import { AchievementService } from './entries/achievement/achievement.service';
import { LinkController } from './entries/link/link.controller';
import { LinkService } from './entries/link/link.service';

@Module({
  controllers: [
    CandidateProfileController,
    ExperienceController,
    EducationController,
    CertificationController,
    SkillController,
    ProjectController,
    AchievementController,
    LinkController,
  ],
  providers: [
    CandidateProfileService,
    ExperienceService,
    EducationService,
    CertificationService,
    SkillService,
    ProjectService,
    AchievementService,
    LinkService,
  ],
})
export class CandidateProfileModule {}
