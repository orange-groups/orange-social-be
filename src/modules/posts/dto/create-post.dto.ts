import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { PostPrivacy } from '../types/post.types';

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsIn(['public', 'friends', 'only_me'])
  privacy: PostPrivacy = 'public';
}
