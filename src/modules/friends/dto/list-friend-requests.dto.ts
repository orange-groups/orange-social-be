import { IsIn } from 'class-validator';
import { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';

export class ListFriendRequestsDto extends CursorPaginationDto {
  @IsIn(['incoming', 'outgoing'])
  direction!: 'incoming' | 'outgoing';
}
