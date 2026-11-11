import { IsString, MaxLength, MinLength } from 'class-validator';
import { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';

export class SearchUsersDto extends CursorPaginationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;
}
