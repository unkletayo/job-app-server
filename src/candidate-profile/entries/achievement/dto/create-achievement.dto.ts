import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAchievementDto {
  @IsString()
  @IsNotEmpty()
  description!: string;
}
