import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateJobPreferencesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetRoles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seniority?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @IsOptional()
  @IsBoolean()
  remotePreference?: boolean;

  @IsOptional()
  @IsBoolean()
  hybridPreference?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumSalaryAmount?: number;

  @IsOptional()
  @IsString()
  minimumSalaryCurrency?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  employmentTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredTechnologies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredTechnologies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedCompanies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedTitles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  negativeKeywords?: string[];
}
