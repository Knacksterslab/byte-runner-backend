import { IsUUID, IsNumber } from 'class-validator';

export class EnterContestDto {
  @IsUUID()
  runId: string;

  @IsNumber()
  score: number;

  @IsNumber()
  distance: number;
}
