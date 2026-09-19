import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export const WATCHABLE_SOURCES = ['greenhouse', 'lever'] as const;

export class CreateWatchedCompanyDto {
  @IsIn(WATCHABLE_SOURCES)
  source!: string;

  @IsString()
  @IsNotEmpty()
  boardToken!: string;

  @IsString()
  @IsNotEmpty()
  label!: string;
}
