import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SetUsernameDto {
  @IsString()
  @MinLength(3)
  @MaxLength(16)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores.',
  })
  username: string;
}
