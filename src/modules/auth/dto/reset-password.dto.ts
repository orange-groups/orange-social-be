import {
  IsByteLength,
  IsString,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  token!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(72)
  @IsByteLength(0, 72)
  newPassword!: string;
}
