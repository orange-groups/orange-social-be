import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';

export class SearchUsersDto extends CursorPaginationDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/^(?:@\s*)+/, '') : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;
}
