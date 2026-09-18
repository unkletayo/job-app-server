import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpsertCandidateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  workAuthorization?: string;

  @IsOptional()
  @IsString()
  professionalSummary?: string;
}
