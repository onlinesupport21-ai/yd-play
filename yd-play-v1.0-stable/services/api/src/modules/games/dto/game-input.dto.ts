import { IsInt, Max, Min } from 'class-validator';

export class GameInputDto {
  @IsInt()
  @Min(1)
  seq!: number;

  @IsInt()
  @Min(0)
  @Max(120_000)
  elapsedMs!: number;

  @IsInt()
  @Min(0)
  @Max(3)
  lane!: number;
}
