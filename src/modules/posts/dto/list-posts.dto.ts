import { IsUUID } from 'class-validator';
import { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';

export class ListOwnPostsDto extends CursorPaginationDto {
  @IsUUID()
  declare cursor?: string;
}

export class ListPostsDto extends ListOwnPostsDto {
  @IsUUID()
  authorId!: string;
}
