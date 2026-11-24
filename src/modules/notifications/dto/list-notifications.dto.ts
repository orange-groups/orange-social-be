import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';

export class ListNotificationsDto extends CursorPaginationDto {
  @IsUUID()
  declare cursor?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  unreadOnly: boolean = false;
}
