import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreateLinkDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsUrl()
  url!: string;
}
