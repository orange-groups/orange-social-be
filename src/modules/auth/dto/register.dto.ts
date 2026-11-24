import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NewPasswordPolicy } from '../password-policy';

export class RegisterDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  @MaxLength(150)
  fullName!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Invalid email address' })
  @MaxLength(255)
  email!: string;

  @IsString()
  @NewPasswordPolicy()
  password!: string;
}

export interface AuthUserDto {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  createdAt: string;
}

export interface RegisterResponseDto {
  accessToken: string;
  user: AuthUserDto;
}
