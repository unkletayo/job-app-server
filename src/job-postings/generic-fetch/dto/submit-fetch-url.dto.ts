import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class SubmitFetchUrlDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  company!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsUrl()
  url!: string;
}
