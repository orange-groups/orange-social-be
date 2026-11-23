import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NewPasswordPolicy } from '../password-policy';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @NewPasswordPolicy()
  newPassword!: string;
}
