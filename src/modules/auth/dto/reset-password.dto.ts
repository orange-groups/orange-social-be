import { IsString, Matches } from 'class-validator';
import { NewPasswordPolicy } from '../password-policy';

export class ResetPasswordDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  token!: string;

  @IsString()
  @NewPasswordPolicy()
  newPassword!: string;
}
