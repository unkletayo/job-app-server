import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateDiscoverySourceDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  intervalMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  requestsPerMinute?: number;
}
