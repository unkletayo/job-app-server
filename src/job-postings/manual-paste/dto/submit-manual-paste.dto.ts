import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class SubmitManualPasteDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  company!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsUrl()
  url?: string;
}
