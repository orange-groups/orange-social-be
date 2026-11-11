import { IsUUID } from 'class-validator';
import { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';

export class ListPostsDto extends CursorPaginationDto {
  @IsUUID()
  authorId!: string;
}
